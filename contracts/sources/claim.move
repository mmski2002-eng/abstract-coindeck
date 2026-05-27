module moveinvestor::claim {
    use std::bcs;
    use std::signer;
    use std::vector;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::aptos_account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::smart_table::{Self, SmartTable};
    use moveinvestor::admin_control;
    use moveinvestor::fantasy_league;

    const E_NOT_ADMIN: u64 = 1;
    const E_ALREADY_ACTIVE: u64 = 2;
    const E_NOT_ACTIVE: u64 = 3;
    const E_ALREADY_CLAIMED: u64 = 4;
    const E_NOTHING_TO_CLAIM: u64 = 5;
    const E_NOT_INITIALIZED: u64 = 6;
    const E_CLAIM_EXPIRED: u64 = 7;
    const E_INSUFFICIENT_VAULT: u64 = 8;
    const E_LENGTHS_MISMATCH: u64 = 9;
    const E_DUPLICATE_ADDRESS: u64 = 10;
    const E_CLAIM_NOT_EXPIRED: u64 = 11;

    #[event]
    struct ClaimOpenedEvent has store, drop {
        start_timestamp: u64,
        total_required: u64,
        prize_return_addr: address,
    }

    #[event]
    struct PrizeClaimedEvent has store, drop {
        claimer: address,
        amount: u64,
    }

    #[event]
    struct ClaimClosedEvent has store, drop {
        return_addr: address,
        remaining_returned: u64,
    }

    #[event]
    struct ClaimDaysUpdatedEvent has store, drop {
        admin: address,
        claim_days: u64,
    }

    #[event]
    struct ClaimListUpdatedEvent has store, drop {
        admin: address,
        entries: u64,
        total_required: u64,
    }

    struct ClaimEntry has store, copy, drop {
        amount: u64,
        claimed: bool,
    }

    struct ClaimConfig has key {
        claim_days: u64,
    }

    struct ClaimState has key {
        active: bool,
        start_timestamp: u64,
        prize_return_addr: address,
        claim_cap: SignerCapability,
        // O(1) lookup by claimer address.
        entries: SmartTable<address, ClaimEntry>,
        // Parallel address list for admin-only iteration (set_claim_list, start_claim).
        addrs: vector<address>,
    }

    // SC-06: separate resource so deadline is snapshotted at start_claim time.
    struct ClaimMeta has key {
        deadline_timestamp: u64,
    }

    fun claim_vault_addr(): address {
        account::create_resource_address(&@moveinvestor, b"moveinvestor_claim_vault_v1")
    }

    fun hash_claim_days_payload(days: u64): vector<u8> {
        admin_control::hash_payload(bcs::to_bytes(&days))
    }

    fun hash_claim_list_payload(addrs: &vector<address>, amounts: &vector<u64>): vector<u8> {
        let payload = bcs::to_bytes(addrs);
        vector::append(&mut payload, bcs::to_bytes(amounts));
        admin_control::hash_payload(payload)
    }

    fun hash_start_claim_payload(prize_return_addr: &address): vector<u8> {
        admin_control::hash_payload(bcs::to_bytes(prize_return_addr))
    }

    fun empty_action_hash(): vector<u8> {
        admin_control::hash_payload(vector::empty<u8>())
    }

    // ── Init ──────────────────────────────────────────────────────────────────────

    public entry fun initialize(admin: &signer) {
        assert!(signer::address_of(admin) == @moveinvestor, E_NOT_ADMIN);
        if (!exists<ClaimState>(@moveinvestor)) {
            let (_, claim_cap) = account::create_resource_account(admin, b"moveinvestor_claim_vault_v1");
            move_to(admin, ClaimState {
                active: false,
                start_timestamp: 0,
                prize_return_addr: @moveinvestor,
                claim_cap,
                entries: smart_table::new(),
                addrs: vector::empty(),
            });
        };
        if (!exists<ClaimConfig>(@moveinvestor)) {
            move_to(admin, ClaimConfig { claim_days: 6 });
        };
        if (!exists<ClaimMeta>(@moveinvestor)) {
            move_to(admin, ClaimMeta { deadline_timestamp: 0 });
        };
    }

    // ── Admin config ──────────────────────────────────────────────────────────────

    public entry fun queue_set_claim_days(admin: &signer, days: u64) {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_set_claim_days(),
            hash_claim_days_payload(days),
        );
    }

    public entry fun set_claim_days(admin: &signer, days: u64) acquires ClaimConfig {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::assert_epoch_settings_mutable();
        admin_control::consume_claim_action(
            admin_control::action_set_claim_days(),
            hash_claim_days_payload(days),
        );
        borrow_global_mut<ClaimConfig>(@moveinvestor).claim_days = days;
        event::emit(ClaimDaysUpdatedEvent {
            admin: signer::address_of(admin),
            claim_days: days,
        });
    }

    public entry fun queue_set_claim_list(
        admin: &signer,
        addrs: vector<address>,
        amounts: vector<u64>,
    ) {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_set_claim_list(),
            hash_claim_list_payload(&addrs, &amounts),
        );
    }

    // Replace entire claim list. Call before start_claim.
    public entry fun set_claim_list(
        admin: &signer,
        addrs: vector<address>,
        amounts: vector<u64>,
    ) acquires ClaimState {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_claim_action(
            admin_control::action_set_claim_list(),
            hash_claim_list_payload(&addrs, &amounts),
        );
        let len = vector::length(&addrs);
        assert!(len == vector::length(&amounts), E_LENGTHS_MISMATCH);

        let s = borrow_global_mut<ClaimState>(@moveinvestor);
        assert!(!s.active, E_ALREADY_ACTIVE);

        // Drain existing SmartTable using the parallel address list.
        let i = 0u64;
        let old_len = vector::length(&s.addrs);
        while (i < old_len) {
            let addr = *vector::borrow(&s.addrs, i);
            smart_table::remove(&mut s.entries, addr);
            i = i + 1;
        };
        s.addrs = vector::empty();

        // Reject duplicate addresses in input before touching state.
        let seen = smart_table::new<address, bool>();
        let j = 0u64;
        while (j < len) {
            let addr = *vector::borrow(&addrs, j);
            assert!(!smart_table::contains(&seen, addr), E_DUPLICATE_ADDRESS);
            smart_table::add(&mut seen, addr, true);
            j = j + 1;
        };
        smart_table::destroy(seen);

        // Populate new entries.
        let j = 0u64;
        while (j < len) {
            let addr = *vector::borrow(&addrs, j);
            let amount = *vector::borrow(&amounts, j);
            smart_table::add(&mut s.entries, addr, ClaimEntry { amount, claimed: false });
            vector::push_back(&mut s.addrs, addr);
            j = j + 1;
        };
        let total_required = 0u64;
        let k = 0u64;
        while (k < len) {
            total_required = total_required + *vector::borrow(&amounts, k);
            k = k + 1;
        };
        event::emit(ClaimListUpdatedEvent {
            admin: signer::address_of(admin),
            entries: len,
            total_required,
        });
    }

    public entry fun queue_start_claim(admin: &signer, prize_return_addr: address) {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_start_claim(),
            hash_start_claim_payload(&prize_return_addr),
        );
    }

    // Open the claim window. Admin must fund the claim vault first.
    public entry fun start_claim(
        admin: &signer,
        prize_return_addr: address,
    ) acquires ClaimState, ClaimConfig, ClaimMeta {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_claim_action(
            admin_control::action_start_claim(),
            hash_start_claim_payload(&prize_return_addr),
        );

        let total_required = {
            let s = borrow_global<ClaimState>(@moveinvestor);
            assert!(!s.active, E_ALREADY_ACTIVE);
            let mut_total = 0u64;
            let i = 0u64;
            let len = vector::length(&s.addrs);
            while (i < len) {
                let addr = *vector::borrow(&s.addrs, i);
                mut_total = mut_total + smart_table::borrow(&s.entries, addr).amount;
                i = i + 1;
            };
            mut_total
        };

        assert!(
            coin::balance<AptosCoin>(claim_vault_addr()) >= total_required,
            E_INSUFFICIENT_VAULT
        );

        let claim_days = if (exists<ClaimConfig>(@moveinvestor))
            borrow_global<ClaimConfig>(@moveinvestor).claim_days
        else 6;
        let now = timestamp::now_seconds();
        let s = borrow_global_mut<ClaimState>(@moveinvestor);
        s.active = true;
        s.start_timestamp = now;
        s.prize_return_addr = prize_return_addr;
        // SC-06: snapshot deadline at start time so claim_days changes don't affect active window.
        if (exists<ClaimMeta>(@moveinvestor)) {
            borrow_global_mut<ClaimMeta>(@moveinvestor).deadline_timestamp = now + claim_days * 86400;
        };
        event::emit(ClaimOpenedEvent {
            start_timestamp: s.start_timestamp,
            total_required,
            prize_return_addr,
        });
    }

    // ── User claim — O(1) lookup ──────────────────────────────────────────────────

    public entry fun claim(account: &signer) acquires ClaimState, ClaimMeta {
        let addr = signer::address_of(account);

        let deadline = if (exists<ClaimMeta>(@moveinvestor))
            borrow_global<ClaimMeta>(@moveinvestor).deadline_timestamp
        else 0;

        let entry_amount = {
            let s = borrow_global<ClaimState>(@moveinvestor);
            assert!(s.active, E_NOT_ACTIVE);
            assert!(timestamp::now_seconds() <= deadline, E_CLAIM_EXPIRED);
            assert!(smart_table::contains(&s.entries, addr), E_NOTHING_TO_CLAIM);
            let e = smart_table::borrow(&s.entries, addr);
            assert!(!e.claimed, E_ALREADY_CLAIMED);
            assert!(e.amount > 0, E_NOTHING_TO_CLAIM);
            e.amount
        };

        smart_table::borrow_mut(
            &mut borrow_global_mut<ClaimState>(@moveinvestor).entries,
            addr,
        ).claimed = true;

        let claim_signer = {
            let s = borrow_global<ClaimState>(@moveinvestor);
            account::create_signer_with_capability(&s.claim_cap)
        };
        aptos_account::transfer(&claim_signer, addr, entry_amount);
        event::emit(PrizeClaimedEvent { claimer: addr, amount: entry_amount });
    }

    public entry fun queue_close_claim(admin: &signer) {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_close_claim(),
            empty_action_hash(),
        );
    }

    // ── Admin close ───────────────────────────────────────────────────────────────

    public entry fun close_claim(admin: &signer) acquires ClaimState, ClaimMeta {
        assert!(fantasy_league::is_claim_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_claim_action(
            admin_control::action_close_claim(),
            empty_action_hash(),
        );

        let deadline = if (exists<ClaimMeta>(@moveinvestor))
            borrow_global<ClaimMeta>(@moveinvestor).deadline_timestamp
        else 0;

        let return_addr = {
            let s = borrow_global_mut<ClaimState>(@moveinvestor);
            assert!(s.active, E_NOT_ACTIVE);
            // SC-07: cannot close before deadline — protects users' claim window.
            assert!(timestamp::now_seconds() > deadline, E_CLAIM_NOT_EXPIRED);
            s.active = false;
            s.prize_return_addr
        };

        let remaining = coin::balance<AptosCoin>(claim_vault_addr());
        if (remaining > 0) {
            let claim_signer = {
                let s = borrow_global<ClaimState>(@moveinvestor);
                account::create_signer_with_capability(&s.claim_cap)
            };
            aptos_account::transfer(&claim_signer, return_addr, remaining);
        };
        event::emit(ClaimClosedEvent { return_addr, remaining_returned: remaining });
    }

    // ── Views ─────────────────────────────────────────────────────────────────────

    // (active, start_timestamp, deadline_timestamp, vault_balance, claim_days)
    #[view]
    public fun get_claim_state(): (bool, u64, u64, u64, u64) acquires ClaimState, ClaimConfig, ClaimMeta {
        if (!exists<ClaimState>(@moveinvestor)) return (false, 0, 0, 0, 6);
        let s = borrow_global<ClaimState>(@moveinvestor);
        let claim_days = if (exists<ClaimConfig>(@moveinvestor))
            borrow_global<ClaimConfig>(@moveinvestor).claim_days
        else 6;
        let deadline = if (exists<ClaimMeta>(@moveinvestor))
            borrow_global<ClaimMeta>(@moveinvestor).deadline_timestamp
        else if (s.active) s.start_timestamp + claim_days * 86400 else 0;
        let vault_bal = coin::balance<AptosCoin>(claim_vault_addr());
        (s.active, s.start_timestamp, deadline, vault_bal, claim_days)
    }

    #[view]
    public fun get_claimable(addr: address): u64 acquires ClaimState {
        if (!exists<ClaimState>(@moveinvestor)) return 0;
        let s = borrow_global<ClaimState>(@moveinvestor);
        if (!s.active) return 0;
        if (!smart_table::contains(&s.entries, addr)) return 0;
        let e = smart_table::borrow(&s.entries, addr);
        if (e.claimed) 0 else e.amount
    }

    #[view]
    public fun get_claim_vault_address(): address { claim_vault_addr() }

    #[view]
    public fun get_claim_days(): u64 acquires ClaimConfig {
        if (!exists<ClaimConfig>(@moveinvestor)) return 6;
        borrow_global<ClaimConfig>(@moveinvestor).claim_days
    }
}

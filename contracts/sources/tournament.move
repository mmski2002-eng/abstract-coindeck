module moveinvestor::tournament {
    use std::bcs;
    use std::signer;
    use std::vector;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::aptos_account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use moveinvestor::admin_control;
    use moveinvestor::fantasy_league;

    const E_NOT_ADMIN: u64 = 1;
    const E_NOT_ACTIVE: u64 = 2;
    const E_INVALID_LINEUP: u64 = 3;
    const E_NOT_INITIALIZED: u64 = 4;
    const E_DAY_OUT_OF_RANGE: u64 = 5;
    const E_REST_DAY: u64 = 6;
    const E_ALREADY_STARTED: u64 = 7;
    const E_NO_LINEUP: u64 = 9;
    const E_DUPLICATE_CARD: u64 = 10;

    const SLOTS: u64 = 5;
    const EPOCH_DAYS: u64 = 6;  // active tournament days per epoch
    const WEEK_DAYS: u64 = 7;   // 6 active + 1 rest

    // ── Structs ───────────────────────────────────────────────────────────────────

    struct SlotEntry has store, copy, drop {
        player_id: u8,
        tier: u8,
    }

    struct DayLineup has store, drop {
        day: u64,    // 1-based day within epoch (1..6)
        epoch: u64,
        slots: vector<SlotEntry>,
        league: u8,
    }

    struct PlayerLineup has key, drop {
        lineups: vector<DayLineup>,
    }

    // Global registry of all addresses that have ever submitted a lineup.
    // Used by backend to iterate participants for leaderboard.
    struct Participants has key {
        addrs: vector<address>,
        seen: SmartTable<address, bool>,  // O(1) duplicate check
    }

    struct EpochState has key {
        running: bool,
        start_timestamp: u64,   // unix seconds when start_epoch was called
        base_epoch: u64,        // epoch number at start_timestamp
        first_visible_epoch: u64,
    }

    struct TournamentConfig has key {
        change_lineup_fee: u64,
    }

    struct VaultCap has key {
        cap: SignerCapability,
    }

    // Per-card lock tracking: locked while the submitting day is still active.
    struct LockEntry has store, copy, drop {
        epoch: u64,
        day: u64,
    }

    struct LockedCards has key {
        locks: SmartTable<address, LockEntry>,         // card_addr -> {epoch, day}
        player_locks: SmartTable<address, vector<address>>, // player -> their currently locked cards
    }

    struct CancelConfig has key {
        cancel_lineup_fee: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────────

    struct LineupSubmittedEvent has store, drop {
        addr: address,
        epoch: u64,
        day: u64,
        league: u8,
    }

    #[event]
    struct LineupCancelledEvent has store, drop {
        addr: address,
        epoch: u64,
        day: u64,
        fee: u64,
    }

    #[event]
    struct PrizeDepositedEvent has store, drop {
        funder: address,
        amount: u64,
    }

    #[event]
    struct PrizeWithdrawnEvent has store, drop {
        recipient: address,
        amount: u64,
    }

    #[event]
    struct TournamentConfigUpdatedEvent has store, drop {
        admin: address,
        change_lineup_fee: u64,
    }

    #[event]
    struct CancelFeeUpdatedEvent has store, drop {
        admin: address,
        cancel_lineup_fee: u64,
    }

    #[event]
    struct EpochStartedEvent has store, drop {
        admin: address,
        start_timestamp: u64,
    }

    #[event]
    struct EpochStoppedEvent has store, drop {
        admin: address,
        next_epoch: u64,
    }

    #[event]
    struct EpochsClearedEvent has store, drop {
        admin: address,
        first_visible_epoch: u64,
    }

    #[event]

    struct LineupEvents has key {
        submit_events: event::EventHandle<LineupSubmittedEvent>,
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    fun assert_admin(addr: address) {
        assert!(fantasy_league::is_admin_pub(addr), E_NOT_ADMIN);
    }

    fun hash_withdraw_payload(recipient: &address, amount: u64): vector<u8> {
        let payload = bcs::to_bytes(recipient);
        vector::append(&mut payload, bcs::to_bytes(&amount));
        admin_control::hash_payload(payload)
    }

    fun empty_action_hash(): vector<u8> {
        admin_control::hash_payload(vector::empty<u8>())
    }

    // Pure epoch/day computation from stored values — no resource access.
    fun epoch_day_from(start_ts: u64, base_epoch: u64, running: bool): (u64, u64, bool) {
        if (!running || start_ts == 0) return (base_epoch, 0, false);
        let now = timestamp::now_seconds();
        if (now < start_ts) return (base_epoch, 0, false);
        let elapsed_days = (now - start_ts) / 86400;
        let week_pos = elapsed_days % WEEK_DAYS;
        let weeks_passed = elapsed_days / WEEK_DAYS;
        let epoch = base_epoch + weeks_passed;
        let is_rest = week_pos >= EPOCH_DAYS;
        let day_in_epoch = if (is_rest) 0 else week_pos + 1;
        (epoch, day_in_epoch, is_rest)
    }

    fun vault_addr(): address {
        account::create_resource_address(&@moveinvestor, b"moveinvestor_prize_vault_v2")
    }

    // ── Init ──────────────────────────────────────────────────────────────────────

    public entry fun initialize(admin: &signer) {
        assert!(signer::address_of(admin) == @moveinvestor, E_NOT_ADMIN);
        if (!exists<VaultCap>(@moveinvestor)) {
            let (_, cap) = account::create_resource_account(admin, b"moveinvestor_prize_vault_v2");
            move_to(admin, VaultCap { cap });
        };
        if (!exists<EpochState>(@moveinvestor)) {
            move_to(admin, EpochState {
                running: false,
                start_timestamp: 0,
                base_epoch: 1,
                first_visible_epoch: 1,
            });
        };
        if (!exists<TournamentConfig>(@moveinvestor)) {
            move_to(admin, TournamentConfig { change_lineup_fee: 0 });
        };
        if (!exists<Participants>(@moveinvestor)) {
            move_to(admin, Participants {
                addrs: vector::empty<address>(),
                seen: smart_table::new<address, bool>(),
            });
        };
        if (!exists<LineupEvents>(@moveinvestor)) {
            move_to(admin, LineupEvents {
                submit_events: account::new_event_handle<LineupSubmittedEvent>(admin),
            });
        };
        if (!exists<LockedCards>(@moveinvestor)) {
            move_to(admin, LockedCards {
                locks: smart_table::new<address, LockEntry>(),
                player_locks: smart_table::new<address, vector<address>>(),
            });
        };
        if (!exists<CancelConfig>(@moveinvestor)) {
            move_to(admin, CancelConfig { cancel_lineup_fee: 50_000_000 });
        };
    }

    // ── Admin config ──────────────────────────────────────────────────────────────

    // No-op: LockedCards and CancelConfig are now initialized in initialize().
    public entry fun initialize_locks(admin: &signer) {
        assert!(signer::address_of(admin) == @moveinvestor, E_NOT_ADMIN);
        if (!exists<LockedCards>(@moveinvestor)) {
            move_to(admin, LockedCards {
                locks: smart_table::new<address, LockEntry>(),
                player_locks: smart_table::new<address, vector<address>>(),
            });
        };
        if (!exists<CancelConfig>(@moveinvestor)) {
            move_to(admin, CancelConfig { cancel_lineup_fee: 50_000_000 }); // 0.5 MOVE default
        };
    }

    public entry fun set_config(admin: &signer, change_lineup_fee: u64) acquires TournamentConfig {
        assert_admin(signer::address_of(admin));
        admin_control::assert_epoch_settings_mutable();
        borrow_global_mut<TournamentConfig>(@moveinvestor).change_lineup_fee = change_lineup_fee;
        event::emit(TournamentConfigUpdatedEvent {
            admin: signer::address_of(admin),
            change_lineup_fee,
        });
    }

    public entry fun set_cancel_fee(admin: &signer, fee: u64) acquires CancelConfig {
        assert_admin(signer::address_of(admin));
        admin_control::assert_epoch_settings_mutable();
        assert!(exists<CancelConfig>(@moveinvestor), E_NOT_INITIALIZED);
        borrow_global_mut<CancelConfig>(@moveinvestor).cancel_lineup_fee = fee;
        event::emit(CancelFeeUpdatedEvent {
            admin: signer::address_of(admin),
            cancel_lineup_fee: fee,
        });
    }

    // ── Epoch lifecycle ───────────────────────────────────────────────────────────

    // Start epochs. Days and epoch numbers advance automatically via timestamps:
    //   days 1-6 = tournament, day 7 = rest, day 8 = day 1 of next epoch, etc.
    public entry fun start_epoch(admin: &signer, start_timestamp: u64) acquires EpochState {
        assert_admin(signer::address_of(admin));
        let es = borrow_global_mut<EpochState>(@moveinvestor);
        assert!(!es.running, E_ALREADY_STARTED);
        es.running = true;
        es.start_timestamp = start_timestamp;
        admin_control::on_epoch_started();
        event::emit(EpochStartedEvent {
            admin: signer::address_of(admin),
            start_timestamp,
        });
    }

    public entry fun queue_stop_and_reset(admin: &signer) {
        assert!(fantasy_league::is_emergency_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_stop_and_reset(),
            empty_action_hash(),
        );
    }

    // Stop all epochs and reset state. Requires start_epoch to resume.
    public entry fun stop_and_reset(admin: &signer) acquires EpochState {
        assert!(fantasy_league::is_emergency_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_tournament_action(
            admin_control::action_stop_and_reset(),
            empty_action_hash(),
        );
        let es = borrow_global_mut<EpochState>(@moveinvestor);
        let (next_epoch, _, _) = epoch_day_from(es.start_timestamp, es.base_epoch, es.running);
        es.running = false;
        es.start_timestamp = 0;
        es.base_epoch = next_epoch + 1;
        es.first_visible_epoch = next_epoch + 1;
        admin_control::on_epoch_stopped();
        event::emit(EpochStoppedEvent {
            admin: signer::address_of(admin),
            next_epoch: next_epoch + 1,
        });
    }

    // Hide epochs before the current computed epoch (data stays on-chain).
    public entry fun admin_clear_epochs(admin: &signer) acquires EpochState {
        assert_admin(signer::address_of(admin));
        let es = borrow_global_mut<EpochState>(@moveinvestor);
        let (current_epoch, _, _) = epoch_day_from(es.start_timestamp, es.base_epoch, es.running);
        es.first_visible_epoch = current_epoch;
        event::emit(EpochsClearedEvent {
            admin: signer::address_of(admin),
            first_visible_epoch: current_epoch,
        });
    }

    // ── Prize pool ────────────────────────────────────────────────────────────────

    public entry fun deposit_prize(funder: &signer, amount: u64) {
        assert!(exists<VaultCap>(@moveinvestor), E_NOT_INITIALIZED);
        let funder_addr = signer::address_of(funder);
        aptos_account::transfer(funder, vault_addr(), amount);
        event::emit(PrizeDepositedEvent { funder: funder_addr, amount });
    }

    public entry fun queue_admin_withdraw_to(
        admin: &signer,
        recipient: address,
        amount: u64,
    ) {
        assert!(fantasy_league::is_treasury_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_treasury_withdraw(),
            hash_withdraw_payload(&recipient, amount),
        );
    }

    public entry fun admin_withdraw_to(
        admin: &signer,
        recipient: address,
        amount: u64,
    ) acquires VaultCap {
        assert!(fantasy_league::is_treasury_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_treasury_withdraw_action(
            amount,
            hash_withdraw_payload(&recipient, amount),
        );
        let vault_signer = account::create_signer_with_capability(
            &borrow_global<VaultCap>(@moveinvestor).cap
        );
        aptos_account::transfer(&vault_signer, recipient, amount);
        event::emit(PrizeWithdrawnEvent { recipient, amount });
    }

    // ── Lineup submission ─────────────────────────────────────────────────────────

    public entry fun submit_lineup(
        account: &signer,
        card_addrs: vector<address>,
    ) acquires EpochState, TournamentConfig, PlayerLineup, Participants, LineupEvents, LockedCards {
        assert!(exists<EpochState>(@moveinvestor), E_NOT_INITIALIZED);

        // Extract state values in a single borrow — avoids double-borrow later.
        let (running, start_ts, base_epoch, change_fee) = {
            let es  = borrow_global<EpochState>(@moveinvestor);
            let fee = if (exists<TournamentConfig>(@moveinvestor))
                borrow_global<TournamentConfig>(@moveinvestor).change_lineup_fee else 0;
            (es.running, es.start_timestamp, es.base_epoch, fee)
        };

        assert!(running, E_NOT_ACTIVE);
        let (epoch, day, is_rest) = epoch_day_from(start_ts, base_epoch, running);
        assert!(!is_rest, E_REST_DAY);
        assert!(day >= 1 && day <= EPOCH_DAYS, E_DAY_OUT_OF_RANGE);
        assert!(vector::length(&card_addrs) == SLOTS, E_INVALID_LINEUP);

        let addr = signer::address_of(account);

        // Build slot entries and determine league.
        let slots = vector::empty<SlotEntry>();
        // Counts by on-chain tier encoding: 0=Common, 1=Rare, 2=Epic, 3=Legendary
        let rare: u64 = 0; let epic: u64 = 0; let legendary: u64 = 0;
        let seen_addrs = smart_table::new<address, bool>();
        let j = 0u64;
        while (j < SLOTS) {
            let card_addr = *vector::borrow(&card_addrs, j);
            assert!(!smart_table::contains(&seen_addrs, card_addr), E_DUPLICATE_CARD);
            smart_table::add(&mut seen_addrs, card_addr, true);
            assert!(fantasy_league::get_card_owner(card_addr) == addr, E_INVALID_LINEUP);
            let (player_id, tier) = fantasy_league::get_card_player_tier(card_addr);
            if (tier == 1) rare = rare + 1;
            if (tier == 2) epic = epic + 1;
            if (tier == 3) legendary = legendary + 1;
            vector::push_back(&mut slots, SlotEntry { player_id, tier });
            j = j + 1;
        };
        smart_table::destroy(seen_addrs);
        // League rules:
        //   Gold   — 5 Epic (tier==2) OR any Legendary (tier==3)
        //   Silver — any Epic (1-4), OR 5 Rare (all slots Rare, no Epic/Legendary)
        //   Bronze — everything else
        let league: u8 = if (legendary > 0 || epic >= 5) 2
            else if (epic > 0 || rare >= 5) 1
            else 0;

        // Detect resubmit for this epoch+day.
        let resubmit_idx = 0u64;
        let is_resubmit = false;
        if (exists<PlayerLineup>(addr)) {
            let pl = borrow_global<PlayerLineup>(addr);
            let i = 0u64;
            let len = vector::length(&pl.lineups);
            while (i < len) {
                let l = vector::borrow(&pl.lineups, i);
                if (l.day == day && l.epoch == epoch) {
                    resubmit_idx = i;
                    is_resubmit = true;
                    break
                };
                i = i + 1;
            };
        };

        if (is_resubmit && change_fee > 0) {
            aptos_account::transfer(account, vault_addr(), change_fee);
        };

        if (!exists<PlayerLineup>(addr)) {
            move_to(account, PlayerLineup { lineups: vector::empty() });
        };

        let pl = borrow_global_mut<PlayerLineup>(addr);
        if (is_resubmit) {
            let lineup = vector::borrow_mut(&mut pl.lineups, resubmit_idx);
            lineup.slots = slots;
            lineup.league = league;
        } else {
            vector::push_back(&mut pl.lineups, DayLineup { day, epoch, slots, league });
            // Prune entries from past epochs — keeps vector bounded to EPOCH_DAYS entries.
            let i = 0u64;
            while (i < vector::length(&pl.lineups)) {
                if (vector::borrow(&pl.lineups, i).epoch < epoch) {
                    vector::swap_remove(&mut pl.lineups, i);
                } else {
                    i = i + 1;
                };
            };
            // Register participant globally on first-ever lineup (O(1) via SmartTable).
            let parts = borrow_global_mut<Participants>(@moveinvestor);
            if (!smart_table::contains(&parts.seen, addr)) {
                smart_table::add(&mut parts.seen, addr, true);
                vector::push_back(&mut parts.addrs, addr);
            };
        };

        // Emit event — backend indexes these to build leaderboards.
        let ev = borrow_global_mut<LineupEvents>(@moveinvestor);
        event::emit_event(&mut ev.submit_events, LineupSubmittedEvent { addr, epoch, day, league });

        // Lock submitted cards for the current day (unlock old cards first).
        let unlock_ts = start_ts + day * 86400;
        assert!(exists<LockedCards>(@moveinvestor), E_NOT_INITIALIZED);
        assert!(fantasy_league::is_locks_initialized(), E_NOT_INITIALIZED);
        {
            let lc = borrow_global_mut<LockedCards>(@moveinvestor);
            if (smart_table::contains(&lc.player_locks, addr)) {
                let old_cards = smart_table::remove(&mut lc.player_locks, addr);
                let k = 0u64;
                while (k < vector::length(&old_cards)) {
                    let ca = *vector::borrow(&old_cards, k);
                    if (smart_table::contains(&lc.locks, ca)) {
                        smart_table::remove(&mut lc.locks, ca);
                    };
                    fantasy_league::unlock_card(ca);
                    k = k + 1;
                };
            };
            let new_locked = vector::empty<address>();
            let k = 0u64;
            while (k < vector::length(&card_addrs)) {
                let ca = *vector::borrow(&card_addrs, k);
                if (smart_table::contains(&lc.locks, ca)) {
                    *smart_table::borrow_mut(&mut lc.locks, ca) = LockEntry { epoch, day };
                } else {
                    smart_table::add(&mut lc.locks, ca, LockEntry { epoch, day });
                };
                fantasy_league::lock_card_until(ca, unlock_ts);
                vector::push_back(&mut new_locked, ca);
                k = k + 1;
            };
            smart_table::add(&mut lc.player_locks, addr, new_locked);
        };
    }

    // ── Lineup management ─────────────────────────────────────────────────────────

    public entry fun clear_my_lineups(account: &signer) acquires PlayerLineup {
        assert_admin(signer::address_of(account));
        let addr = signer::address_of(account);
        if (exists<PlayerLineup>(addr)) { move_from<PlayerLineup>(addr); };
    }

    // Paid cancel: remove today's lineup and unlock its cards.
    // Fee goes to the prize vault.
    public entry fun cancel_lineup(
        account: &signer,
    ) acquires EpochState, PlayerLineup, LockedCards, CancelConfig {
        let addr = signer::address_of(account);
        assert!(exists<EpochState>(@moveinvestor), E_NOT_INITIALIZED);

        let (running, start_ts, base_epoch) = {
            let es = borrow_global<EpochState>(@moveinvestor);
            (es.running, es.start_timestamp, es.base_epoch)
        };
        assert!(running, E_NOT_ACTIVE);
        let (epoch, day, _) = epoch_day_from(start_ts, base_epoch, running);

        // Find today's lineup entry.
        assert!(exists<PlayerLineup>(addr), E_NO_LINEUP);
        let lineup_idx = {
            let pl = borrow_global<PlayerLineup>(addr);
            let len = vector::length(&pl.lineups);
            let i = 0u64;
            let found_idx = len; // sentinel = not found
            while (i < len) {
                let l = vector::borrow(&pl.lineups, i);
                if (l.day == day && l.epoch == epoch) { found_idx = i; break };
                i = i + 1;
            };
            assert!(found_idx < len, E_NO_LINEUP);
            found_idx
        };

        // Charge fee.
        assert!(exists<CancelConfig>(@moveinvestor), E_NOT_INITIALIZED);
        let fee = borrow_global<CancelConfig>(@moveinvestor).cancel_lineup_fee;
        if (fee > 0) {
            aptos_account::transfer(account, vault_addr(), fee);
        };

        // Remove lineup entry.
        let pl = borrow_global_mut<PlayerLineup>(addr);
        vector::remove(&mut pl.lineups, lineup_idx);
        event::emit(LineupCancelledEvent { addr, epoch, day, fee });

        // Unlock cards.
        assert!(exists<LockedCards>(@moveinvestor), E_NOT_INITIALIZED);
        {
            let lc = borrow_global_mut<LockedCards>(@moveinvestor);
            if (smart_table::contains(&lc.player_locks, addr)) {
                let old_cards = smart_table::remove(&mut lc.player_locks, addr);
                let k = 0u64;
                while (k < vector::length(&old_cards)) {
                    let ca = *vector::borrow(&old_cards, k);
                    if (smart_table::contains(&lc.locks, ca)) {
                        smart_table::remove(&mut lc.locks, ca);
                    };
                    fantasy_league::unlock_card(ca);
                    k = k + 1;
                };
            };
        };
    }

    // ── Views ─────────────────────────────────────────────────────────────────────

    // (running, current_epoch, day_in_epoch, is_rest_day, start_timestamp,
    //  prize_pool, change_fee, first_visible_epoch)
    #[view]
    public fun get_state(): (bool, u64, u64, bool, u64, u64, u64, u64) acquires EpochState, TournamentConfig {
        if (!exists<EpochState>(@moveinvestor)) return (false, 1, 0, false, 0, 0, 0, 1);
        let (running, start_ts, base_epoch, first_visible) = {
            let es = borrow_global<EpochState>(@moveinvestor);
            (es.running, es.start_timestamp, es.base_epoch, es.first_visible_epoch)
        };
        let (epoch, day, is_rest) = epoch_day_from(start_ts, base_epoch, running);
        let prize = coin::balance<AptosCoin>(vault_addr());
        let fee = if (exists<TournamentConfig>(@moveinvestor))
            borrow_global<TournamentConfig>(@moveinvestor).change_lineup_fee else 0;
        (running, epoch, day, is_rest, start_ts, prize, fee, first_visible)
    }

    #[view]
    public fun get_vault_address(): address { vault_addr() }

    // All participants who have ever submitted a lineup (for backend iteration).
    #[view]
    public fun get_all_participants(): vector<address> acquires Participants {
        if (!exists<Participants>(@moveinvestor)) return vector::empty<address>();
        *&borrow_global<Participants>(@moveinvestor).addrs
    }

    #[view]
    public fun get_participants_page(offset: u64, limit: u64): vector<address> acquires Participants {
        if (!exists<Participants>(@moveinvestor)) return vector::empty<address>();
        let addrs = &borrow_global<Participants>(@moveinvestor).addrs;
        let total = vector::length(addrs);
        let result = vector::empty<address>();
        let i = offset;
        let fetched = 0u64;
        while (i < total && fetched < limit) {
            vector::push_back(&mut result, *vector::borrow(addrs, i));
            i = i + 1;
            fetched = fetched + 1;
        };
        result
    }

    #[view]
    public fun get_participants_count(): u64 acquires Participants {
        if (!exists<Participants>(@moveinvestor)) return 0;
        vector::length(&borrow_global<Participants>(@moveinvestor).addrs)
    }

    #[view]
    public fun get_epoch_range(): (u64, u64) acquires EpochState {
        if (!exists<EpochState>(@moveinvestor)) return (1, 1);
        let es = borrow_global<EpochState>(@moveinvestor);
        let (cur_epoch, _, _) = epoch_day_from(es.start_timestamp, es.base_epoch, es.running);
        (es.first_visible_epoch, cur_epoch)
    }

    #[view]
    public fun has_lineup_for_day(addr: address, day: u64): bool acquires PlayerLineup, EpochState {
        if (!exists<EpochState>(@moveinvestor)) return false;
        let es = borrow_global<EpochState>(@moveinvestor);
        let (epoch, _, _) = epoch_day_from(es.start_timestamp, es.base_epoch, es.running);
        has_lineup_for_day_epoch(addr, day, epoch)
    }

    #[view]
    public fun has_lineup_for_day_epoch(addr: address, day: u64, epoch: u64): bool acquires PlayerLineup {
        if (!exists<PlayerLineup>(addr)) return false;
        let pl = borrow_global<PlayerLineup>(addr);
        let i = 0u64;
        let len = vector::length(&pl.lineups);
        while (i < len) {
            let l = vector::borrow(&pl.lineups, i);
            if (l.day == day && l.epoch == epoch) return true;
            i = i + 1;
        };
        false
    }

    // (days[], leagues[]) for current epoch
    #[view]
    public fun get_player_lineups(addr: address): (vector<u64>, vector<u8>) acquires PlayerLineup, EpochState {
        if (!exists<EpochState>(@moveinvestor)) return get_player_lineups_epoch(addr, 1);
        let es = borrow_global<EpochState>(@moveinvestor);
        let (epoch, _, _) = epoch_day_from(es.start_timestamp, es.base_epoch, es.running);
        get_player_lineups_epoch(addr, epoch)
    }

    #[view]
    public fun get_player_lineups_epoch(addr: address, epoch: u64): (vector<u64>, vector<u8>) acquires PlayerLineup {
        let days    = vector::empty<u64>();
        let leagues = vector::empty<u8>();
        if (!exists<PlayerLineup>(addr)) return (days, leagues);
        let pl = borrow_global<PlayerLineup>(addr);
        let i = 0u64;
        let len = vector::length(&pl.lineups);
        while (i < len) {
            let l = vector::borrow(&pl.lineups, i);
            if (l.epoch == epoch) {
                vector::push_back(&mut days, l.day);
                vector::push_back(&mut leagues, l.league);
            };
            i = i + 1;
        };
        (days, leagues)
    }

    // (player_ids[], tiers[]) for a specific day in the current epoch
    #[view]
    public fun get_lineup_slots(addr: address, day: u64): (vector<u8>, vector<u8>) acquires PlayerLineup, EpochState {
        if (!exists<EpochState>(@moveinvestor)) return get_lineup_slots_epoch(addr, day, 1);
        let es = borrow_global<EpochState>(@moveinvestor);
        let (epoch, _, _) = epoch_day_from(es.start_timestamp, es.base_epoch, es.running);
        get_lineup_slots_epoch(addr, day, epoch)
    }

    #[view]
    public fun get_lineup_slots_epoch(addr: address, day: u64, epoch: u64): (vector<u8>, vector<u8>) acquires PlayerLineup {
        let pids  = vector::empty<u8>();
        let tiers = vector::empty<u8>();
        if (!exists<PlayerLineup>(addr)) return (pids, tiers);
        let pl = borrow_global<PlayerLineup>(addr);
        let i = 0u64;
        let len = vector::length(&pl.lineups);
        while (i < len) {
            let l = vector::borrow(&pl.lineups, i);
            if (l.day == day && l.epoch == epoch) {
                let j = 0u64;
                let slen = vector::length(&l.slots);
                while (j < slen) {
                    let s = vector::borrow(&l.slots, j);
                    vector::push_back(&mut pids, s.player_id);
                    vector::push_back(&mut tiers, s.tier);
                    j = j + 1;
                };
                return (pids, tiers)
            };
            i = i + 1;
        };
        (pids, tiers)
    }

    // True if card is locked for the current tournament day.
    #[view]
    public fun is_card_locked(card_addr: address): bool {
        fantasy_league::is_card_locked(card_addr)
    }

    #[view]
    public fun get_cancel_fee(): u64 acquires CancelConfig {
        if (!exists<CancelConfig>(@moveinvestor)) return 0;
        borrow_global<CancelConfig>(@moveinvestor).cancel_lineup_fee
    }

    // Bulk lineup fetch for leaderboard worker.
    // Returns (addrs, flat_pids, flat_tiers, total_participants).
    // flat_pids/flat_tiers have exactly SLOTS (5) entries per returned address.
    // Paginate over [offset, offset+limit) of the global Participants list.
    // Addresses without a lineup for this day/epoch are omitted from results.
    #[view]
    public fun get_day_lineups_paginated(
        day: u64,
        epoch: u64,
        offset: u64,
        limit: u64,
    ): (vector<address>, vector<u8>, vector<u8>, u64) acquires Participants, PlayerLineup {
        let result_addrs = vector::empty<address>();
        let result_pids  = vector::empty<u8>();
        let result_tiers = vector::empty<u8>();

        if (!exists<Participants>(@moveinvestor)) {
            return (result_addrs, result_pids, result_tiers, 0)
        };

        let participants = borrow_global<Participants>(@moveinvestor);
        let total = vector::length(&participants.addrs);

        if (offset >= total) {
            return (result_addrs, result_pids, result_tiers, total)
        };

        let end = if (offset + limit > total) { total } else { offset + limit };
        let i = offset;

        while (i < end) {
            let addr = *vector::borrow(&participants.addrs, i);
            i = i + 1;

            if (exists<PlayerLineup>(addr)) {
                let pl = borrow_global<PlayerLineup>(addr);
                let j = 0u64;
                let len = vector::length(&pl.lineups);
                while (j < len) {
                    let l = vector::borrow(&pl.lineups, j);
                    if (l.day == day && l.epoch == epoch) {
                        vector::push_back(&mut result_addrs, addr);
                        let k = 0u64;
                        let slen = vector::length(&l.slots);
                        while (k < slen) {
                            let s = vector::borrow(&l.slots, k);
                            vector::push_back(&mut result_pids, s.player_id);
                            vector::push_back(&mut result_tiers, s.tier);
                            k = k + 1;
                        };
                        j = len; // exit inner loop (no break in Move)
                    } else {
                        j = j + 1;
                    };
                };
            };
        };

        (result_addrs, result_pids, result_tiers, total)
    }
}

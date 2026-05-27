module moveinvestor::admin_control {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::hash;

    friend moveinvestor::tournament;
    friend moveinvestor::claim;
    friend moveinvestor::oracle;
    friend moveinvestor::marketplace;
    friend moveinvestor::fantasy_league;

    const E_NOT_OWNER: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_BAD_ACTION_TYPE: u64 = 3;
    const E_ACTION_NOT_QUEUED: u64 = 4;
    const E_ACTION_NOT_READY: u64 = 5;
    const E_EPOCH_CONFIG_LOCKED: u64 = 6;
    const E_WITHDRAW_OVER_PER_TX_LIMIT: u64 = 7;
    const E_WITHDRAW_OVER_DAILY_LIMIT: u64 = 8;

    const ROLE_ORACLE: u8 = 1;
    const ROLE_TREASURY: u8 = 2;
    const ROLE_NFT: u8 = 4;
    const ROLE_CLAIM: u8 = 8;
    const ROLE_EMERGENCY: u8 = 16;
    const ROLE_FULL: u8 = 31;

    const ACTION_SET_BASE_URIS: u8 = 0;
    const ACTION_SET_CHEST_PRICES: u8 = 1;
    const ACTION_ADMIN_MINT_TO: u8 = 2;
    const ACTION_RESET_ALL_ORACLE_DAYS: u8 = 3;
    const ACTION_TREASURY_WITHDRAW: u8 = 4;
    const ACTION_SET_CLAIM_DAYS: u8 = 5;
    const ACTION_SET_CLAIM_LIST: u8 = 6;
    const ACTION_START_CLAIM: u8 = 7;
    const ACTION_CLOSE_CLAIM: u8 = 8;
    const ACTION_STOP_AND_RESET: u8 = 9;
    const ACTION_CLEAR_LISTINGS: u8 = 10;
    const ACTION_COUNT: u64 = 11;

    struct QueuedAction has store, copy, drop {
        action_type: u8,
        payload_hash: vector<u8>,
        created_at: u64,
        execute_after: u64,
    }

    struct TimelockState has key {
        delays: vector<u64>,
        queued: vector<QueuedAction>,
    }

    struct WithdrawalPolicy has key {
        enabled: bool,
        per_tx_limit: u64,
        daily_limit: u64,
        spent_today: u64,
        day_index: u64,
    }

    struct EpochGuard has key {
        freeze_during_epoch: bool,
        epoch_active: bool,
    }

    struct RoleList has key {
        addresses: vector<address>,
        roles: vector<u8>,
    }

    #[event]
    struct AdminActionQueuedEvent has store, drop {
        action_type: u8,
        payload_hash: vector<u8>,
        created_at: u64,
        execute_after: u64,
    }

    #[event]
    struct AdminActionExecutedEvent has store, drop {
        action_type: u8,
        payload_hash: vector<u8>,
        executed_at: u64,
    }

    #[event]
    struct TimelockDelayUpdatedEvent has store, drop {
        action_type: u8,
        delay_secs: u64,
    }

    #[event]
    struct WithdrawalPolicyUpdatedEvent has store, drop {
        enabled: bool,
        per_tx_limit: u64,
        daily_limit: u64,
    }

    #[event]
    struct EpochGuardUpdatedEvent has store, drop {
        freeze_during_epoch: bool,
        epoch_active: bool,
    }

    #[event]
    struct RoleGrantedEvent has store, drop {
        addr: address,
        role_mask: u8,
    }

    #[event]
    struct RoleRevokedEvent has store, drop {
        addr: address,
        role_mask: u8,
    }

    fun assert_owner(addr: address) {
        assert!(addr == @moveinvestor, E_NOT_OWNER);
    }

    // Maps each action type to the role bitmask required to queue it.
    // Owner (@moveinvestor) may always queue any action regardless of this mapping.
    fun action_required_role(action_type: u8): u8 {
        if (action_type == ACTION_TREASURY_WITHDRAW)    return ROLE_TREASURY;
        if (action_type == ACTION_SET_CLAIM_DAYS)       return ROLE_CLAIM;
        if (action_type == ACTION_SET_CLAIM_LIST)       return ROLE_CLAIM;
        if (action_type == ACTION_START_CLAIM)          return ROLE_CLAIM;
        if (action_type == ACTION_CLOSE_CLAIM)          return ROLE_CLAIM;
        if (action_type == ACTION_RESET_ALL_ORACLE_DAYS) return ROLE_ORACLE;
        if (action_type == ACTION_STOP_AND_RESET)       return ROLE_EMERGENCY;
        if (action_type == ACTION_SET_BASE_URIS)        return ROLE_NFT;
        if (action_type == ACTION_SET_CHEST_PRICES)     return ROLE_NFT;
        if (action_type == ACTION_ADMIN_MINT_TO)        return ROLE_NFT;
        if (action_type == ACTION_CLEAR_LISTINGS)       return ROLE_NFT;
        ROLE_FULL
    }

    fun assert_valid_action_type(action_type: u8) {
        assert!((action_type as u64) < ACTION_COUNT, E_BAD_ACTION_TYPE);
    }

    fun bytes_equal(left: &vector<u8>, right: &vector<u8>): bool {
        let left_len = vector::length(left);
        if (left_len != vector::length(right)) return false;
        let i = 0u64;
        while (i < left_len) {
            if (*vector::borrow(left, i) != *vector::borrow(right, i)) return false;
            i = i + 1;
        };
        true
    }

    fun default_delays(): vector<u64> {
        let delays = vector::empty<u64>();
        let i = 0u64;
        while (i < ACTION_COUNT) {
            vector::push_back(&mut delays, 0);
            i = i + 1;
        };
        delays
    }

    fun current_day_index(): u64 {
        timestamp::now_seconds() / 86400
    }

    fun maybe_reset_daily_window(policy: &mut WithdrawalPolicy) {
        let day_index = current_day_index();
        if (policy.day_index != day_index) {
            policy.day_index = day_index;
            policy.spent_today = 0;
        };
    }

    public entry fun initialize(admin: &signer) {
        let addr = signer::address_of(admin);
        assert_owner(addr);

        if (!exists<TimelockState>(@moveinvestor)) {
            move_to(admin, TimelockState {
                delays: default_delays(),
                queued: vector::empty<QueuedAction>(),
            });
        };
        if (!exists<WithdrawalPolicy>(@moveinvestor)) {
            move_to(admin, WithdrawalPolicy {
                enabled: false,
                per_tx_limit: 0,
                daily_limit: 0,
                spent_today: 0,
                day_index: current_day_index(),
            });
        };
        if (!exists<EpochGuard>(@moveinvestor)) {
            move_to(admin, EpochGuard {
                freeze_during_epoch: false,
                epoch_active: false,
            });
        };
        if (!exists<RoleList>(@moveinvestor)) {
            move_to(admin, RoleList {
                addresses: vector::empty<address>(),
                roles: vector::empty<u8>(),
            });
        };
    }

    public entry fun set_action_delay(admin: &signer, action_type: u8, delay_secs: u64)
    acquires TimelockState {
        assert_owner(signer::address_of(admin));
        assert_valid_action_type(action_type);
        assert!(exists<TimelockState>(@moveinvestor), E_NOT_INITIALIZED);

        *vector::borrow_mut(
            &mut borrow_global_mut<TimelockState>(@moveinvestor).delays,
            action_type as u64,
        ) = delay_secs;
        event::emit(TimelockDelayUpdatedEvent { action_type, delay_secs });
    }

    public entry fun set_withdrawal_policy(
        admin: &signer,
        enabled: bool,
        per_tx_limit: u64,
        daily_limit: u64,
    ) acquires WithdrawalPolicy {
        assert_owner(signer::address_of(admin));
        assert!(exists<WithdrawalPolicy>(@moveinvestor), E_NOT_INITIALIZED);

        let policy = borrow_global_mut<WithdrawalPolicy>(@moveinvestor);
        policy.enabled = enabled;
        policy.per_tx_limit = per_tx_limit;
        policy.daily_limit = daily_limit;
        maybe_reset_daily_window(policy);
        event::emit(WithdrawalPolicyUpdatedEvent { enabled, per_tx_limit, daily_limit });
    }

    public entry fun set_epoch_guard(admin: &signer, freeze_during_epoch: bool)
    acquires EpochGuard {
        assert_owner(signer::address_of(admin));
        assert!(exists<EpochGuard>(@moveinvestor), E_NOT_INITIALIZED);

        let guard = borrow_global_mut<EpochGuard>(@moveinvestor);
        guard.freeze_during_epoch = freeze_during_epoch;
        event::emit(EpochGuardUpdatedEvent {
            freeze_during_epoch,
            epoch_active: guard.epoch_active,
        });
    }

    public entry fun configure_governance(
        admin: &signer,
        freeze_during_epoch: bool,
        withdraw_enabled: bool,
        per_tx_limit: u64,
        daily_limit: u64,
        delays: vector<u64>,
    ) acquires TimelockState, WithdrawalPolicy, EpochGuard {
        assert_owner(signer::address_of(admin));
        assert!(exists<TimelockState>(@moveinvestor), E_NOT_INITIALIZED);
        assert!(exists<WithdrawalPolicy>(@moveinvestor), E_NOT_INITIALIZED);
        assert!(exists<EpochGuard>(@moveinvestor), E_NOT_INITIALIZED);
        assert!(vector::length(&delays) == ACTION_COUNT, E_BAD_ACTION_TYPE);

        let state = borrow_global_mut<TimelockState>(@moveinvestor);
        let i = 0u64;
        while (i < ACTION_COUNT) {
            let delay_secs = *vector::borrow(&delays, i);
            *vector::borrow_mut(&mut state.delays, i) = delay_secs;
            event::emit(TimelockDelayUpdatedEvent {
                action_type: i as u8,
                delay_secs,
            });
            i = i + 1;
        };

        let policy = borrow_global_mut<WithdrawalPolicy>(@moveinvestor);
        policy.enabled = withdraw_enabled;
        policy.per_tx_limit = per_tx_limit;
        policy.daily_limit = daily_limit;
        maybe_reset_daily_window(policy);
        event::emit(WithdrawalPolicyUpdatedEvent {
            enabled: withdraw_enabled,
            per_tx_limit,
            daily_limit,
        });

        let guard = borrow_global_mut<EpochGuard>(@moveinvestor);
        guard.freeze_during_epoch = freeze_during_epoch;
        event::emit(EpochGuardUpdatedEvent {
            freeze_during_epoch,
            epoch_active: guard.epoch_active,
        });
    }

    public entry fun grant_role(admin: &signer, addr: address, role_mask: u8) acquires RoleList {
        assert_owner(signer::address_of(admin));
        if (!exists<RoleList>(@moveinvestor)) {
            move_to(admin, RoleList { addresses: vector::empty<address>(), roles: vector::empty<u8>() });
        };
        let rl = borrow_global_mut<RoleList>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&rl.addresses);
        while (i < len) {
            if (*vector::borrow(&rl.addresses, i) == addr) {
                *vector::borrow_mut(&mut rl.roles, i) = *vector::borrow(&rl.roles, i) | role_mask;
                event::emit(RoleGrantedEvent { addr, role_mask });
                return
            };
            i = i + 1;
        };
        vector::push_back(&mut rl.addresses, addr);
        vector::push_back(&mut rl.roles, role_mask);
        event::emit(RoleGrantedEvent { addr, role_mask });
    }

    public entry fun revoke_role(admin: &signer, addr: address, role_mask: u8) acquires RoleList {
        assert_owner(signer::address_of(admin));
        if (!exists<RoleList>(@moveinvestor)) return;
        let rl = borrow_global_mut<RoleList>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&rl.addresses);
        while (i < len) {
            if (*vector::borrow(&rl.addresses, i) == addr) {
                let new_mask = *vector::borrow(&rl.roles, i) & (255u8 ^ role_mask);
                if (new_mask == 0) {
                    vector::swap_remove(&mut rl.addresses, i);
                    vector::swap_remove(&mut rl.roles, i);
                } else {
                    *vector::borrow_mut(&mut rl.roles, i) = new_mask;
                };
                event::emit(RoleRevokedEvent { addr, role_mask });
                return
            };
            i = i + 1;
        };
    }

    public fun has_role(addr: address, role: u8): bool acquires RoleList {
        if (addr == @moveinvestor) return true;
        if (!exists<RoleList>(@moveinvestor)) return false;
        let rl = borrow_global<RoleList>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&rl.addresses);
        while (i < len) {
            if (*vector::borrow(&rl.addresses, i) == addr) {
                return (*vector::borrow(&rl.roles, i) & role) != 0
            };
            i = i + 1;
        };
        false
    }

    public fun hash_payload(payload: vector<u8>): vector<u8> {
        hash::sha2_256(payload)
    }

    public fun queue_action(admin: &signer, action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState, RoleList {
        let addr = signer::address_of(admin);
        assert_valid_action_type(action_type);
        assert!(
            addr == @moveinvestor || has_role(addr, action_required_role(action_type)),
            E_NOT_OWNER,
        );
        assert!(exists<TimelockState>(@moveinvestor), E_NOT_INITIALIZED);

        let state = borrow_global_mut<TimelockState>(@moveinvestor);
        let delay = *vector::borrow(&state.delays, action_type as u64);
        let now = timestamp::now_seconds();
        let execute_after = now + delay;

        let i = 0u64;
        let len = vector::length(&state.queued);
        while (i < len) {
            let queued = vector::borrow(&state.queued, i);
            if (queued.action_type == action_type && bytes_equal(&queued.payload_hash, &payload_hash)) {
                // SC-14: duplicate action already pending — no-op, do not reset execute_after
                return
            };
            i = i + 1;
        };

        vector::push_back(&mut state.queued, QueuedAction {
            action_type,
            payload_hash,
            created_at: now,
            execute_after,
        });
        event::emit(AdminActionQueuedEvent {
            action_type,
            payload_hash,
            created_at: now,
            execute_after,
        });
    }

    fun consume_action_internal(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        assert_valid_action_type(action_type);
        assert!(exists<TimelockState>(@moveinvestor), E_NOT_INITIALIZED);

        let state = borrow_global_mut<TimelockState>(@moveinvestor);
        let delay = *vector::borrow(&state.delays, action_type as u64);
        if (delay == 0) return;

        let now = timestamp::now_seconds();
        let i = 0u64;
        let len = vector::length(&state.queued);
        while (i < len) {
            let queued = vector::borrow(&state.queued, i);
            if (queued.action_type == action_type && bytes_equal(&queued.payload_hash, &payload_hash)) {
                assert!(now >= queued.execute_after, E_ACTION_NOT_READY);
                let _ = vector::swap_remove(&mut state.queued, i);
                event::emit(AdminActionExecutedEvent {
                    action_type,
                    payload_hash,
                    executed_at: now,
                });
                return
            };
            i = i + 1;
        };
        abort E_ACTION_NOT_QUEUED
    }

    // Compatibility wrapper — kept so existing callers in other packages can still resolve it.
    // Internal modules should use typed consume_* variants instead.
    public(friend) fun consume_action_if_ready(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        consume_action_internal(action_type, payload_hash)
    }

    // Compatibility wrapper — kept for compatible upgrade policy.
    public(friend) fun check_and_consume_withdraw(amount: u64) acquires WithdrawalPolicy {
        consume_withdraw_internal(amount)
    }

    // ── Typed action consumers (SC-01 fix: each module consumes only its own actions) ──

    public(friend) fun consume_claim_action(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        assert!(
            action_type == ACTION_SET_CLAIM_DAYS ||
            action_type == ACTION_SET_CLAIM_LIST ||
            action_type == ACTION_START_CLAIM ||
            action_type == ACTION_CLOSE_CLAIM,
            E_BAD_ACTION_TYPE
        );
        consume_action_internal(action_type, payload_hash)
    }

    public(friend) fun consume_nft_action(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        assert!(
            action_type == ACTION_SET_BASE_URIS ||
            action_type == ACTION_SET_CHEST_PRICES ||
            action_type == ACTION_ADMIN_MINT_TO,
            E_BAD_ACTION_TYPE
        );
        consume_action_internal(action_type, payload_hash)
    }

    public(friend) fun consume_oracle_action(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        assert!(action_type == ACTION_RESET_ALL_ORACLE_DAYS, E_BAD_ACTION_TYPE);
        consume_action_internal(action_type, payload_hash)
    }

    public(friend) fun consume_marketplace_action(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        assert!(action_type == ACTION_CLEAR_LISTINGS, E_BAD_ACTION_TYPE);
        consume_action_internal(action_type, payload_hash)
    }

    public(friend) fun consume_tournament_action(action_type: u8, payload_hash: vector<u8>)
    acquires TimelockState {
        assert!(action_type == ACTION_STOP_AND_RESET, E_BAD_ACTION_TYPE);
        consume_action_internal(action_type, payload_hash)
    }

    // SC-01 + SC-02 fix: treasury withdraw atomically consumes timelock AND withdrawal policy.
    public(friend) fun consume_treasury_withdraw_action(amount: u64, payload_hash: vector<u8>)
    acquires TimelockState, WithdrawalPolicy {
        consume_action_internal(ACTION_TREASURY_WITHDRAW, payload_hash);
        consume_withdraw_internal(amount)
    }

    public fun assert_epoch_settings_mutable() acquires EpochGuard {
        if (!exists<EpochGuard>(@moveinvestor)) return;
        let guard = borrow_global<EpochGuard>(@moveinvestor);
        assert!(!(guard.freeze_during_epoch && guard.epoch_active), E_EPOCH_CONFIG_LOCKED);
    }

    public(friend) fun on_epoch_started() acquires EpochGuard {
        if (!exists<EpochGuard>(@moveinvestor)) return;
        let guard = borrow_global_mut<EpochGuard>(@moveinvestor);
        guard.epoch_active = true;
        event::emit(EpochGuardUpdatedEvent {
            freeze_during_epoch: guard.freeze_during_epoch,
            epoch_active: true,
        });
    }

    public(friend) fun on_epoch_stopped() acquires EpochGuard {
        if (!exists<EpochGuard>(@moveinvestor)) return;
        let guard = borrow_global_mut<EpochGuard>(@moveinvestor);
        guard.epoch_active = false;
        event::emit(EpochGuardUpdatedEvent {
            freeze_during_epoch: guard.freeze_during_epoch,
            epoch_active: false,
        });
    }

    fun consume_withdraw_internal(amount: u64) acquires WithdrawalPolicy {
        if (!exists<WithdrawalPolicy>(@moveinvestor)) return;
        let policy = borrow_global_mut<WithdrawalPolicy>(@moveinvestor);
        if (!policy.enabled) return;

        maybe_reset_daily_window(policy);
        if (policy.per_tx_limit > 0) {
            assert!(amount <= policy.per_tx_limit, E_WITHDRAW_OVER_PER_TX_LIMIT);
        };
        if (policy.daily_limit > 0) {
            assert!(policy.spent_today + amount <= policy.daily_limit, E_WITHDRAW_OVER_DAILY_LIMIT);
        };
        policy.spent_today = policy.spent_today + amount;
    }

    #[view]
    public fun is_initialized(): bool {
        exists<TimelockState>(@moveinvestor)
            && exists<WithdrawalPolicy>(@moveinvestor)
            && exists<EpochGuard>(@moveinvestor)
    }

    #[view]
    public fun get_action_delays(): vector<u64> acquires TimelockState {
        if (!exists<TimelockState>(@moveinvestor)) return default_delays();
        *&borrow_global<TimelockState>(@moveinvestor).delays
    }

    #[view]
    public fun get_withdrawal_policy(): (bool, u64, u64, u64, u64) acquires WithdrawalPolicy {
        if (!exists<WithdrawalPolicy>(@moveinvestor)) return (false, 0, 0, 0, current_day_index());
        let policy = borrow_global<WithdrawalPolicy>(@moveinvestor);
        (policy.enabled, policy.per_tx_limit, policy.daily_limit, policy.spent_today, policy.day_index)
    }

    #[view]
    public fun get_epoch_guard(): (bool, bool) acquires EpochGuard {
        if (!exists<EpochGuard>(@moveinvestor)) return (false, false);
        let guard = borrow_global<EpochGuard>(@moveinvestor);
        (guard.freeze_during_epoch, guard.epoch_active)
    }

    #[view]
    public fun get_pending_actions(): (vector<u8>, vector<u64>, vector<vector<u8>>) acquires TimelockState {
        let action_types = vector::empty<u8>();
        let execute_afters = vector::empty<u64>();
        let hashes = vector::empty<vector<u8>>();
        if (!exists<TimelockState>(@moveinvestor)) return (action_types, execute_afters, hashes);

        let queued = &borrow_global<TimelockState>(@moveinvestor).queued;
        let i = 0u64;
        let len = vector::length(queued);
        while (i < len) {
            let item = vector::borrow(queued, i);
            vector::push_back(&mut action_types, item.action_type);
            vector::push_back(&mut execute_afters, item.execute_after);
            vector::push_back(&mut hashes, *&item.payload_hash);
            i = i + 1;
        };
        (action_types, execute_afters, hashes)
    }

    #[view]
    public fun get_action_delay(action_type: u8): u64 acquires TimelockState {
        assert_valid_action_type(action_type);
        if (!exists<TimelockState>(@moveinvestor)) return 0;
        *vector::borrow(&borrow_global<TimelockState>(@moveinvestor).delays, action_type as u64)
    }

    #[view]
    public fun get_role_list(): (vector<address>, vector<u8>) acquires RoleList {
        if (!exists<RoleList>(@moveinvestor)) return (vector::empty<address>(), vector::empty<u8>());
        let rl = borrow_global<RoleList>(@moveinvestor);
        (*&rl.addresses, *&rl.roles)
    }

    public fun action_set_base_uris(): u8 { ACTION_SET_BASE_URIS }
    public fun action_set_chest_prices(): u8 { ACTION_SET_CHEST_PRICES }
    public fun action_admin_mint_to(): u8 { ACTION_ADMIN_MINT_TO }
    public fun action_reset_all_oracle_days(): u8 { ACTION_RESET_ALL_ORACLE_DAYS }
    public fun action_treasury_withdraw(): u8 { ACTION_TREASURY_WITHDRAW }
    public fun action_set_claim_days(): u8 { ACTION_SET_CLAIM_DAYS }
    public fun action_set_claim_list(): u8 { ACTION_SET_CLAIM_LIST }
    public fun action_start_claim(): u8 { ACTION_START_CLAIM }
    public fun action_close_claim(): u8 { ACTION_CLOSE_CLAIM }
    public fun action_stop_and_reset(): u8 { ACTION_STOP_AND_RESET }
    public fun action_clear_listings(): u8 { ACTION_CLEAR_LISTINGS }

    public fun role_oracle(): u8 { ROLE_ORACLE }
    public fun role_treasury(): u8 { ROLE_TREASURY }
    public fun role_nft(): u8 { ROLE_NFT }
    public fun role_claim(): u8 { ROLE_CLAIM }
    public fun role_emergency(): u8 { ROLE_EMERGENCY }
    public fun role_full(): u8 { ROLE_FULL }
}

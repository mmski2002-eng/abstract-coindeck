module moveinvestor::oracle {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use moveinvestor::admin_control;
    use moveinvestor::fantasy_league;

    const E_NOT_ADMIN: u64 = 1;
    const E_WRONG_LENGTHS: u64 = 2;
    const E_SCORE_TOO_HIGH: u64 = 3;

    const MAX_BASE_POINTS: u64 = 10_000;

    struct PlayerDayScore has store, copy, drop {
        player_id: u8,
        base_points: u64,
    }

    struct DayData has store, drop {
        day: u64,
        scores: vector<PlayerDayScore>,
        posted: bool,
    }

    struct OracleState has key {
        days: vector<DayData>,
    }

    #[event]
    struct OracleScoresPostedEvent has store, drop {
        admin: address,
        day: u64,
        entries: u64,
    }

    #[event]
    struct OraclePostedFlagChangedEvent has store, drop {
        admin: address,
        day: u64,
        posted: bool,
    }

    #[event]
    struct OracleDaysResetEvent has store, drop {
        admin: address,
    }

    fun empty_action_hash(): vector<u8> {
        admin_control::hash_payload(vector::empty<u8>())
    }

    public entry fun initialize(admin: &signer) {
        assert!(signer::address_of(admin) == @moveinvestor, E_NOT_ADMIN);
        if (!exists<OracleState>(@moveinvestor)) {
            move_to(admin, OracleState { days: vector::empty() });
        };
    }

    // Any admin can post or repost scores for any day at any time.
    public entry fun post_day_scores(
        admin: &signer,
        day: u64,
        player_ids: vector<u8>,
        base_points: vector<u64>,
    ) acquires OracleState {
        assert!(fantasy_league::is_oracle_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        let plen = vector::length(&player_ids);
        assert!(plen == vector::length(&base_points), E_WRONG_LENGTHS);

        let scores = vector::empty<PlayerDayScore>();
        let j = 0u64;
        while (j < plen) {
            let pts = *vector::borrow(&base_points, j);
            assert!(pts <= MAX_BASE_POINTS, E_SCORE_TOO_HIGH);
            vector::push_back(&mut scores, PlayerDayScore {
                player_id: *vector::borrow(&player_ids, j),
                base_points: pts,
            });
            j = j + 1;
        };

        let state = borrow_global_mut<OracleState>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&state.days);
        while (i < len) {
            let d = vector::borrow_mut(&mut state.days, i);
            if (d.day == day) {
                d.scores = scores;
                d.posted = true;
                event::emit(OracleScoresPostedEvent {
                    admin: signer::address_of(admin),
                    day,
                    entries: plen,
                });
                return
            };
            i = i + 1;
        };
        vector::push_back(&mut state.days, DayData { day, scores, posted: true });
        event::emit(OracleScoresPostedEvent {
            admin: signer::address_of(admin),
            day,
            entries: plen,
        });
    }

    // Toggle posted flag without changing scores.
    public entry fun set_posted(admin: &signer, day: u64, posted: bool) acquires OracleState {
        assert!(fantasy_league::is_oracle_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        let state = borrow_global_mut<OracleState>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&state.days);
        while (i < len) {
            let d = vector::borrow_mut(&mut state.days, i);
            if (d.day == day) {
                d.posted = posted;
                event::emit(OraclePostedFlagChangedEvent {
                    admin: signer::address_of(admin),
                    day,
                    posted,
                });
                return
            };
            i = i + 1;
        };
    }

    public entry fun queue_reset_all_days(admin: &signer) {
        assert!(fantasy_league::is_oracle_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_reset_all_oracle_days(),
            empty_action_hash(),
        );
    }

    public entry fun reset_all_days(admin: &signer) acquires OracleState {
        assert!(fantasy_league::is_oracle_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_oracle_action(
            admin_control::action_reset_all_oracle_days(),
            empty_action_hash(),
        );
        if (!exists<OracleState>(@moveinvestor)) return;
        let state = borrow_global_mut<OracleState>(@moveinvestor);
        while (!vector::is_empty(&state.days)) {
            vector::pop_back(&mut state.days);
        };
        event::emit(OracleDaysResetEvent { admin: signer::address_of(admin) });
    }

    // ── Views ─────────────────────────────────────────────────────────────────────

    #[view]
    public fun get_day_scores(day: u64): (vector<u8>, vector<u64>, bool) acquires OracleState {
        let pids = vector::empty<u8>();
        let pts  = vector::empty<u64>();
        if (!exists<OracleState>(@moveinvestor)) return (pids, pts, false);
        let state = borrow_global<OracleState>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&state.days);
        while (i < len) {
            let d = vector::borrow(&state.days, i);
            if (d.day == day) {
                let j = 0u64;
                let slen = vector::length(&d.scores);
                while (j < slen) {
                    let s = vector::borrow(&d.scores, j);
                    vector::push_back(&mut pids, s.player_id);
                    vector::push_back(&mut pts, s.base_points);
                    j = j + 1;
                };
                return (pids, pts, d.posted)
            };
            i = i + 1;
        };
        (pids, pts, false)
    }

    #[view]
    public fun is_day_posted(day: u64): bool acquires OracleState {
        if (!exists<OracleState>(@moveinvestor)) return false;
        let state = borrow_global<OracleState>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&state.days);
        while (i < len) {
            let d = vector::borrow(&state.days, i);
            if (d.day == day) return d.posted;
            i = i + 1;
        };
        false
    }
}

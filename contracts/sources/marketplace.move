module moveinvestor::marketplace {
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::object;
    use aptos_std::smart_table::{Self, SmartTable};
    use moveinvestor::admin_control;
    use moveinvestor::fantasy_league;
    use moveinvestor::tournament;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_LISTING_NOT_FOUND: u64 = 2;
    const E_NOT_SELLER: u64 = 3;
    const E_CANNOT_BUY_OWN: u64 = 4;
    const E_NOT_OWNER: u64 = 5;
    const E_ALREADY_LISTED: u64 = 6;
    const E_NOT_ADMIN: u64 = 7;
    const E_PRICE_TOO_LOW: u64 = 8;
    const E_CARD_LOCKED: u64 = 9;
    const E_LISTINGS_NOT_EMPTY: u64 = 10;
    const E_BATCH_TOO_LARGE: u64 = 12;
    const E_DUPLICATE_LISTING: u64 = 13;
    const E_NO_PENDING_CLEAR: u64 = 14;

    const MAX_BATCH_BUY: u64 = 20;
    const MAX_CLEAR_PAGE: u64 = 100;

    // Minimum price ensures fee (price * 5 / 100) is always >= 1
    const MIN_LISTING_PRICE: u64 = 20;
    const MARKETPLACE_FEE_BPS: u64 = 500; // 5%

    #[event]
    struct CardListedEvent has store, drop {
        listing_id: u64,
        seller: address,
        card_addr: address,
        player_id: u8,
        tier: u8,
        price: u64,
    }

    #[event]
    struct CardBoughtEvent has store, drop {
        listing_id: u64,
        buyer: address,
        seller: address,
        card_addr: address,
        price: u64,
        fee: u64,
    }

    #[event]
    struct ListingCancelledEvent has store, drop {
        listing_id: u64,
        seller: address,
        card_addr: address,
    }

    #[event]
    struct ListingsClearedEvent has store, drop {
        admin: address,
        cleared_count: u64,
    }

    #[event]
    struct ListingIdResetEvent has store, drop {
        admin: address,
    }

    struct Listing has store, copy, drop {
        id: u64,
        seller: address,
        card_addr: address,
        player_id: u8,
        tier: u8,
        price: u64,
        vec_idx: u64, // position in listing_ids for O(1) swap_remove
    }

    struct Marketplace has key {
        listings: SmartTable<u64, Listing>,    // listing_id -> Listing
        by_card: SmartTable<address, u64>,     // card_addr -> listing_id (O(1) duplicate check)
        listing_ids: vector<u64>,              // ordered ids for pagination
        next_id: u64,
        pending_clear: bool,                   // set by admin_clear_listings, consumed by pages
    }

    fun empty_action_hash(): vector<u8> {
        admin_control::hash_payload(vector::empty<u8>())
    }

    // ── Init ─────────────────────────────────────────────────────────────────────

    public entry fun initialize(admin: &signer) {
        assert!(signer::address_of(admin) == @moveinvestor, E_NOT_ADMIN);
        if (!exists<Marketplace>(@moveinvestor)) {
            move_to(admin, Marketplace {
                listings: smart_table::new<u64, Listing>(),
                by_card: smart_table::new<address, u64>(),
                listing_ids: vector::empty<u64>(),
                next_id: 0,
                pending_clear: false,
            });
        };
    }

    // ── Internal helpers ──────────────────────────────────────────────────────────

    // O(1) removal: swap-remove from listing_ids and fix the displaced entry's vec_idx.
    fun remove_listing_internal(mp: &mut Marketplace, id: u64) {
        let listing = smart_table::remove(&mut mp.listings, id);
        smart_table::remove(&mut mp.by_card, listing.card_addr);

        let last_idx = vector::length(&mp.listing_ids) - 1;
        if (listing.vec_idx < last_idx) {
            // A different entry was moved into listing.vec_idx — update its vec_idx.
            let swapped_id = *vector::borrow(&mp.listing_ids, last_idx);
            vector::swap_remove(&mut mp.listing_ids, listing.vec_idx);
            smart_table::borrow_mut(&mut mp.listings, swapped_id).vec_idx = listing.vec_idx;
        } else {
            vector::swap_remove(&mut mp.listing_ids, listing.vec_idx);
        };
    }

    // ── Listing ───────────────────────────────────────────────────────────────────

    public entry fun list_card(seller: &signer, card_addr: address, price: u64) acquires Marketplace {
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        assert!(price >= MIN_LISTING_PRICE, E_PRICE_TOO_LOW);
        let seller_addr = signer::address_of(seller);

        assert!(fantasy_league::get_card_owner(card_addr) == seller_addr, E_NOT_OWNER);
        assert!(!tournament::is_card_locked(card_addr), E_CARD_LOCKED);

        let mp = borrow_global_mut<Marketplace>(@moveinvestor);
        assert!(!smart_table::contains(&mp.by_card, card_addr), E_ALREADY_LISTED);

        let (player_id, tier) = fantasy_league::get_card_player_tier(card_addr);
        let id = mp.next_id;
        mp.next_id = id + 1;
        let vec_idx = vector::length(&mp.listing_ids);
        vector::push_back(&mut mp.listing_ids, id);

        let listing = Listing { id, seller: seller_addr, card_addr, player_id, tier, price, vec_idx };
        smart_table::add(&mut mp.listings, id, listing);
        smart_table::add(&mut mp.by_card, card_addr, id);

        fantasy_league::remove_from_registry(seller_addr, card_addr);
        let escrow_ref = fantasy_league::extract_linear_transfer_ref(card_addr);
        object::transfer_with_ref(escrow_ref, @moveinvestor);

        event::emit(CardListedEvent { listing_id: id, seller: seller_addr, card_addr, player_id, tier, price });
    }

    // ── Buy ───────────────────────────────────────────────────────────────────────

    public entry fun buy_card(buyer: &signer, listing_id: u64) acquires Marketplace {
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        let buyer_addr = signer::address_of(buyer);
        let mp = borrow_global_mut<Marketplace>(@moveinvestor);

        assert!(smart_table::contains(&mp.listings, listing_id), E_LISTING_NOT_FOUND);
        let listing = *smart_table::borrow(&mp.listings, listing_id);
        assert!(listing.seller != buyer_addr, E_CANNOT_BUY_OWN);

        remove_listing_internal(mp, listing_id);

        fantasy_league::ensure_user_cards(buyer);
        let fee = listing.price * MARKETPLACE_FEE_BPS / 10_000;
        coin::transfer<AptosCoin>(buyer, @moveinvestor, fee);
        coin::transfer<AptosCoin>(buyer, listing.seller, listing.price - fee);

        let linear_ref = fantasy_league::extract_linear_transfer_ref(listing.card_addr);
        object::transfer_with_ref(linear_ref, buyer_addr);
        fantasy_league::add_to_registry(buyer_addr, listing.card_addr);
        event::emit(CardBoughtEvent {
            listing_id: listing.id,
            buyer: buyer_addr,
            seller: listing.seller,
            card_addr: listing.card_addr,
            price: listing.price,
            fee,
        });
    }

    public entry fun buy_cards_batch(buyer: &signer, listing_ids: vector<u64>) acquires Marketplace {
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        let count = vector::length(&listing_ids);
        assert!(count > 0 && count <= MAX_BATCH_BUY, E_BATCH_TOO_LARGE);

        // Reject duplicate listing ids.
        let seen = smart_table::new<u64, bool>();
        let k = 0u64;
        while (k < count) {
            let lid = *vector::borrow(&listing_ids, k);
            assert!(!smart_table::contains(&seen, lid), E_DUPLICATE_LISTING);
            smart_table::add(&mut seen, lid, true);
            k = k + 1;
        };
        smart_table::destroy(seen);

        let buyer_addr = signer::address_of(buyer);
        fantasy_league::ensure_user_cards(buyer);

        let i = 0u64;
        while (i < count) {
            let listing_id = *vector::borrow(&listing_ids, i);
            let mp = borrow_global_mut<Marketplace>(@moveinvestor);
            assert!(smart_table::contains(&mp.listings, listing_id), E_LISTING_NOT_FOUND);
            let listing = *smart_table::borrow(&mp.listings, listing_id);
            assert!(listing.seller != buyer_addr, E_CANNOT_BUY_OWN);
            remove_listing_internal(mp, listing_id);

            let fee = listing.price * MARKETPLACE_FEE_BPS / 10_000;
            coin::transfer<AptosCoin>(buyer, @moveinvestor, fee);
            coin::transfer<AptosCoin>(buyer, listing.seller, listing.price - fee);
            let linear_ref = fantasy_league::extract_linear_transfer_ref(listing.card_addr);
            object::transfer_with_ref(linear_ref, buyer_addr);
            fantasy_league::add_to_registry(buyer_addr, listing.card_addr);
            event::emit(CardBoughtEvent {
                listing_id: listing.id,
                buyer: buyer_addr,
                seller: listing.seller,
                card_addr: listing.card_addr,
                price: listing.price,
                fee,
            });
            i = i + 1;
        };
    }

    // ── Cancel ────────────────────────────────────────────────────────────────────

    public entry fun cancel_listing(seller: &signer, listing_id: u64) acquires Marketplace {
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        let seller_addr = signer::address_of(seller);
        let mp = borrow_global_mut<Marketplace>(@moveinvestor);

        assert!(smart_table::contains(&mp.listings, listing_id), E_LISTING_NOT_FOUND);
        let listing = *smart_table::borrow(&mp.listings, listing_id);
        assert!(listing.seller == seller_addr, E_NOT_SELLER);

        remove_listing_internal(mp, listing_id);

        let return_ref = fantasy_league::extract_linear_transfer_ref(listing.card_addr);
        object::transfer_with_ref(return_ref, seller_addr);
        fantasy_league::add_to_registry(seller_addr, listing.card_addr);
        event::emit(ListingCancelledEvent { listing_id: listing.id, seller: seller_addr, card_addr: listing.card_addr });
    }

    // ── Admin clear (paginated) ───────────────────────────────────────────────────

    public entry fun queue_admin_clear_listings(admin: &signer) {
        assert!(fantasy_league::is_emergency_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_clear_listings(),
            empty_action_hash(),
        );
    }

    // Timelocked entry point: authorizes the clear operation.
    // Then call admin_clear_listings_page repeatedly until all listings are gone.
    public entry fun admin_clear_listings(admin: &signer) acquires Marketplace {
        assert!(fantasy_league::is_emergency_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_marketplace_action(
            admin_control::action_clear_listings(),
            empty_action_hash(),
        );
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        borrow_global_mut<Marketplace>(@moveinvestor).pending_clear = true;
        // Execute first page immediately.
        let cleared = do_clear_page(borrow_global_mut<Marketplace>(@moveinvestor));
        event::emit(ListingsClearedEvent { admin: signer::address_of(admin), cleared_count: cleared });
    }

    // Continue a pending clear. Any admin can call until marketplace is empty.
    public entry fun admin_clear_listings_page(admin: &signer) acquires Marketplace {
        assert!(fantasy_league::is_emergency_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        let mp = borrow_global_mut<Marketplace>(@moveinvestor);
        assert!(mp.pending_clear, E_NO_PENDING_CLEAR);
        let cleared = do_clear_page(mp);
        event::emit(ListingsClearedEvent { admin: signer::address_of(admin), cleared_count: cleared });
    }

    fun do_clear_page(mp: &mut Marketplace): u64 {
        let cleared = 0u64;
        while (!vector::is_empty(&mp.listing_ids) && cleared < MAX_CLEAR_PAGE) {
            let id = *vector::borrow(&mp.listing_ids, 0);
            let listing = *smart_table::borrow(&mp.listings, id);
            remove_listing_internal(mp, id);
            let return_ref = fantasy_league::extract_linear_transfer_ref(listing.card_addr);
            object::transfer_with_ref(return_ref, listing.seller);
            fantasy_league::add_to_registry(listing.seller, listing.card_addr);
            cleared = cleared + 1;
        };
        if (vector::is_empty(&mp.listing_ids)) {
            mp.pending_clear = false;
            mp.next_id = 0;
        };
        cleared
    }

    // Reset ID counter for a new season. Requires marketplace to be empty.
    public entry fun reset_next_id(admin: &signer) acquires Marketplace {
        assert!(fantasy_league::is_emergency_admin_pub(signer::address_of(admin)), E_NOT_ADMIN);
        assert!(exists<Marketplace>(@moveinvestor), E_NOT_INITIALIZED);
        let mp = borrow_global_mut<Marketplace>(@moveinvestor);
        assert!(vector::is_empty(&mp.listing_ids), E_LISTINGS_NOT_EMPTY);
        mp.next_id = 0;
        event::emit(ListingIdResetEvent { admin: signer::address_of(admin) });
    }

    // ── Views ─────────────────────────────────────────────────────────────────────

    #[view]
    public fun listing_count(): u64 acquires Marketplace {
        if (!exists<Marketplace>(@moveinvestor)) return 0;
        vector::length(&borrow_global<Marketplace>(@moveinvestor).listing_ids)
    }

    #[view]
    public fun get_listings_page(offset: u64, limit: u64): (
        vector<u64>,
        vector<address>,
        vector<address>,
        vector<u8>,
        vector<u8>,
        vector<u64>,
    ) acquires Marketplace {
        let ids        = vector::empty<u64>();
        let sellers    = vector::empty<address>();
        let card_addrs = vector::empty<address>();
        let pids       = vector::empty<u8>();
        let tiers      = vector::empty<u8>();
        let prices     = vector::empty<u64>();
        if (!exists<Marketplace>(@moveinvestor)) return (ids, sellers, card_addrs, pids, tiers, prices);
        let mp = borrow_global<Marketplace>(@moveinvestor);
        let total = vector::length(&mp.listing_ids);
        let i = offset;
        let fetched = 0u64;
        while (i < total && fetched < limit) {
            let id = *vector::borrow(&mp.listing_ids, i);
            let l = smart_table::borrow(&mp.listings, id);
            vector::push_back(&mut ids,        l.id);
            vector::push_back(&mut sellers,    l.seller);
            vector::push_back(&mut card_addrs, l.card_addr);
            vector::push_back(&mut pids,       l.player_id);
            vector::push_back(&mut tiers,      l.tier);
            vector::push_back(&mut prices,     l.price);
            i = i + 1;
            fetched = fetched + 1;
        };
        (ids, sellers, card_addrs, pids, tiers, prices)
    }

    #[view]
    public fun get_marketplace_fee_bps(): u64 { MARKETPLACE_FEE_BPS }
}

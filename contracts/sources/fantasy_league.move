module moveinvestor::fantasy_league {
    use std::bcs;
    use std::option;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::aptos_account;
    use aptos_framework::object::{Self, ConstructorRef};
    use aptos_token_objects::collection;
    use aptos_token_objects::token;

    friend moveinvestor::marketplace;
    friend moveinvestor::tournament;

    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use std::hash;
    use moveinvestor::admin_control;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_CARD_LOCKED: u64 = 12;
    const E_NOT_ENOUGH_CARDS: u64 = 3;
    const E_MAX_TIER: u64 = 4;
    const E_NO_CHESTS: u64 = 5;
    const E_NOT_OWNER: u64 = 6;
    const E_NOT_ADMIN: u64 = 7;
    const E_ADMIN_EXISTS: u64 = 8;
    const E_ADMIN_NOT_FOUND: u64 = 9;
    const E_NICKNAME_TOO_LONG: u64 = 11;
    const MAX_NICKNAME_LEN: u64 = 30;

    const MAX_TIER: u8 = 3;
    const MERGE_COUNT: u64 = 5;
    const MAX_ADMINS: u64 = 20;
    const E_TOO_MANY_ADMINS: u64 = 10;
    const MAX_PLAYERS: u8 = 50;
    const DEFAULT_CHEST_PRICE: u64 = 10_000_000;
    const MAX_CHEST_BATCH: u64 = 100;
    const E_DUPLICATE_CARD: u64 = 13;
    const E_WRONG_CARD: u64 = 14;
    const E_BATCH_TOO_LARGE: u64 = 15;
    const E_INVALID_CHEST_TYPE: u64 = 16;

    const COLLECTION_NAME: vector<u8> = b"MoveInvestor Portfolio";
    const COLLECTION_DESC: vector<u8> = b"MoveInvestor crypto investment portfolio on Movement";
    const COLLECTION_URI:  vector<u8> = b"https://moveinvestor.app";

    const DEFAULT_CARD_BASE_URI:  vector<u8> = b"https://assets.coingecko.com/coins/images/";
    const DEFAULT_CHEST_BASE_URI: vector<u8> = b"https://moveinvestor.app/nft/chest/";

    // ── Structs ───────────────────────────────────────────────────────────────────

    struct MintAuthority has key {
        signer_cap: SignerCapability,
    }

    // Owner (@moveinvestor) can add/remove admins.
    // Admins can perform all ops except add_admin/remove_admin.
    struct AdminList has key {
        admins: vector<address>,
    }

    struct BaseUris has key {
        card:  String,
        chest: String,
    }

    struct ChestPrices has key {
        wooden: u64,
        iron:   u64,
        silver: u64,
    }

    struct UserCards has key {
        card_addrs: vector<address>,
    }

    struct UserChests has key {
        chest_addrs: vector<address>,
    }

    struct PlayerProfile has key {
        nickname: String,
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct PlayerCard has key {
        player_id: u8,
        tier: u8,
        burn_ref: token::BurnRef,
        transfer_ref: object::TransferRef,
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct ChestToken has key {
        chest_type: u8,
        burn_ref: token::BurnRef,
        transfer_ref: object::TransferRef,
    }

    // card_addr -> unlock_timestamp (seconds). Managed by tournament via friend calls.
    struct CardLocks has key {
        locks: SmartTable<address, u64>,
    }

    #[event]
    struct AdminAddedEvent has store, drop {
        admin: address,
        added_admin: address,
    }

    #[event]
    struct AdminRemovedEvent has store, drop {
        admin: address,
        removed_admin: address,
    }

    #[event]
    struct BaseUrisUpdatedEvent has store, drop {
        admin: address,
    }

    #[event]
    struct CardReissuedEvent has store, drop {
        admin: address,
        owner: address,
        old_card: address,
        player_id: u8,
        tier: u8,
    }

    #[event]
    struct AdminCardMintedEvent has store, drop {
        admin: address,
        recipient: address,
        player_id: u8,
        tier: u8,
        count: u64,
    }

    #[event]
    struct ChestPricesUpdatedEvent has store, drop {
        admin: address,
        wooden: u64,
        iron: u64,
        silver: u64,
    }

    // ── Admin helpers ─────────────────────────────────────────────────────────────

    fun is_admin(addr: address): bool acquires AdminList {
        if (addr == @moveinvestor) return true;
        if (!exists<AdminList>(@moveinvestor)) return false;
        let list = borrow_global<AdminList>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&list.admins);
        while (i < len) {
            if (*vector::borrow(&list.admins, i) == addr) return true;
            i = i + 1;
        };
        false
    }

    // Public so other modules (tournament, oracle, claim) can reuse without duplicating logic.
    public fun is_admin_pub(addr: address): bool acquires AdminList {
        is_admin(addr)
    }

    fun is_nft_admin(addr: address): bool acquires AdminList {
        is_admin(addr) || admin_control::has_role(addr, admin_control::role_nft())
    }
    fun is_oracle_admin(addr: address): bool acquires AdminList {
        is_admin(addr) || admin_control::has_role(addr, admin_control::role_oracle())
    }
    fun is_treasury_admin(addr: address): bool acquires AdminList {
        is_admin(addr) || admin_control::has_role(addr, admin_control::role_treasury())
    }
    fun is_claim_admin(addr: address): bool acquires AdminList {
        is_admin(addr) || admin_control::has_role(addr, admin_control::role_claim())
    }
    fun is_emergency_admin(addr: address): bool acquires AdminList {
        is_admin(addr) || admin_control::has_role(addr, admin_control::role_emergency())
    }

    public fun is_nft_admin_pub(addr: address): bool acquires AdminList { is_nft_admin(addr) }
    public fun is_oracle_admin_pub(addr: address): bool acquires AdminList { is_oracle_admin(addr) }
    public fun is_treasury_admin_pub(addr: address): bool acquires AdminList { is_treasury_admin(addr) }
    public fun is_claim_admin_pub(addr: address): bool acquires AdminList { is_claim_admin(addr) }
    public fun is_emergency_admin_pub(addr: address): bool acquires AdminList { is_emergency_admin(addr) }

    fun assert_admin(addr: address) acquires AdminList {
        assert!(is_admin(addr), E_NOT_ADMIN);
    }

    fun hash_base_uri_payload(card_uri: &vector<u8>, chest_uri: &vector<u8>): vector<u8> {
        let payload = bcs::to_bytes(card_uri);
        vector::append(&mut payload, bcs::to_bytes(chest_uri));
        admin_control::hash_payload(payload)
    }

    fun hash_admin_mint_payload(
        recipient: &address,
        player_id: u8,
        tier: u8,
        count: u64,
    ): vector<u8> {
        let payload = bcs::to_bytes(recipient);
        vector::append(&mut payload, bcs::to_bytes(&player_id));
        vector::append(&mut payload, bcs::to_bytes(&tier));
        vector::append(&mut payload, bcs::to_bytes(&count));
        admin_control::hash_payload(payload)
    }

    fun hash_chest_prices_payload(wooden: u64, iron: u64, silver: u64): vector<u8> {
        let payload = bcs::to_bytes(&wooden);
        vector::append(&mut payload, bcs::to_bytes(&iron));
        vector::append(&mut payload, bcs::to_bytes(&silver));
        admin_control::hash_payload(payload)
    }

    // ── Init ──────────────────────────────────────────────────────────────────────

    public entry fun initialize(admin: &signer) {
        let addr = signer::address_of(admin);
        assert!(addr == @moveinvestor, E_NOT_ADMIN);
        admin_control::initialize(admin);

        if (!exists<MintAuthority>(@moveinvestor)) {
            let (resource_signer, signer_cap) = account::create_resource_account(admin, b"moveinvestor_mint_v1");
            move_to(admin, MintAuthority { signer_cap });
            collection::create_unlimited_collection(
                &resource_signer,
                string::utf8(COLLECTION_DESC),
                string::utf8(COLLECTION_NAME),
                option::none(),
                string::utf8(COLLECTION_URI),
            );
        };
        if (!exists<AdminList>(@moveinvestor)) {
            move_to(admin, AdminList { admins: vector::empty<address>() });
        };
        if (!exists<BaseUris>(@moveinvestor)) {
            move_to(admin, BaseUris {
                card:  string::utf8(DEFAULT_CARD_BASE_URI),
                chest: string::utf8(DEFAULT_CHEST_BASE_URI),
            });
        };
        if (!exists<ChestPrices>(@moveinvestor)) {
            move_to(admin, ChestPrices {
                wooden: DEFAULT_CHEST_PRICE,
                iron:   DEFAULT_CHEST_PRICE * 3,
                silver: DEFAULT_CHEST_PRICE * 9,
            });
        };
        if (!exists<CardLocks>(@moveinvestor)) {
            move_to(admin, CardLocks { locks: smart_table::new<address, u64>() });
        };
    }

    // ── Multi-admin management (owner only) ───────────────────────────────────────

    public entry fun add_admin(owner: &signer, new_admin: address) acquires AdminList {
        assert!(signer::address_of(owner) == @moveinvestor, E_NOT_ADMIN);
        let list = borrow_global_mut<AdminList>(@moveinvestor);
        let len = vector::length(&list.admins);
        assert!(len < MAX_ADMINS, E_TOO_MANY_ADMINS);
        let i = 0u64;
        while (i < len) {
            assert!(*vector::borrow(&list.admins, i) != new_admin, E_ADMIN_EXISTS);
            i = i + 1;
        };
        vector::push_back(&mut list.admins, new_admin);
        event::emit(AdminAddedEvent {
            admin: signer::address_of(owner),
            added_admin: new_admin,
        });
        admin_control::grant_role(owner, new_admin, admin_control::role_full());
    }

    public entry fun remove_admin(owner: &signer, target: address) acquires AdminList {
        assert!(signer::address_of(owner) == @moveinvestor, E_NOT_ADMIN);
        let list = borrow_global_mut<AdminList>(@moveinvestor);
        let i = 0u64;
        let len = vector::length(&list.admins);
        while (i < len) {
            if (*vector::borrow(&list.admins, i) == target) {
                vector::swap_remove(&mut list.admins, i);
                event::emit(AdminRemovedEvent {
                    admin: signer::address_of(owner),
                    removed_admin: target,
                });
                admin_control::revoke_role(owner, target, admin_control::role_full());
                return
            };
            i = i + 1;
        };
        abort E_ADMIN_NOT_FOUND
    }

    // ── URI management ────────────────────────────────────────────────────────────

    public entry fun queue_set_base_uris(
        admin: &signer,
        card_uri: vector<u8>,
        chest_uri: vector<u8>,
    ) acquires AdminList {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_set_base_uris(),
            hash_base_uri_payload(&card_uri, &chest_uri),
        );
    }

    public entry fun set_base_uris(
        admin: &signer,
        card_uri: vector<u8>,
        chest_uri: vector<u8>,
    ) acquires AdminList, BaseUris {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::consume_nft_action(
            admin_control::action_set_base_uris(),
            hash_base_uri_payload(&card_uri, &chest_uri),
        );
        let uris = borrow_global_mut<BaseUris>(@moveinvestor);
        uris.card  = string::utf8(card_uri);
        uris.chest = string::utf8(chest_uri);
        event::emit(BaseUrisUpdatedEvent { admin: signer::address_of(admin) });
    }

    // Burn old card and re-mint with current base URI. Used to fix cards minted with wrong URI.
    public entry fun admin_reissue_card(
        admin: &signer,
        card_addr: address,
    ) acquires AdminList, PlayerCard, UserCards, MintAuthority, BaseUris, CardLocks {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        assert!(!is_card_locked(card_addr), E_CARD_LOCKED);

        let owner = object::owner(object::address_to_object<PlayerCard>(card_addr));
        let (player_id, tier) = {
            let c = borrow_global<PlayerCard>(card_addr);
            (c.player_id, c.tier)
        };

        if (exists<UserCards>(owner)) {
            let uc = borrow_global_mut<UserCards>(owner);
            let i = 0u64;
            let len = vector::length(&uc.card_addrs);
            while (i < len) {
                if (*vector::borrow(&uc.card_addrs, i) == card_addr) {
                    vector::swap_remove(&mut uc.card_addrs, i);
                    break
                };
                i = i + 1;
            };
        };

        let PlayerCard { player_id: _, tier: _, burn_ref, transfer_ref: _ } =
            move_from<PlayerCard>(card_addr);
        token::burn(burn_ref);
        unlock_card(card_addr);

        mint_card_to(owner, player_id, tier);
        event::emit(CardReissuedEvent {
            admin: signer::address_of(admin),
            owner,
            old_card: card_addr,
            player_id,
            tier,
        });
    }

    // ── User init ─────────────────────────────────────────────────────────────────

    // Nickname is stored once; subsequent calls do nothing to the profile.
    public entry fun create_inventory(account: &signer, nickname: vector<u8>) {
        let addr = signer::address_of(account);
        if (!exists<UserCards>(addr)) {
            move_to(account, UserCards { card_addrs: vector::empty<address>() });
        };
        if (!exists<UserChests>(addr)) {
            move_to(account, UserChests { chest_addrs: vector::empty<address>() });
        };
        if (!exists<PlayerProfile>(addr)) {
            let nick = string::utf8(nickname);
            assert!(string::length(&nick) <= MAX_NICKNAME_LEN, E_NICKNAME_TOO_LONG);
            move_to(account, PlayerProfile { nickname: nick });
        };
    }

    // ── Admin card mint ───────────────────────────────────────────────────────────

    public entry fun queue_admin_mint_to(
        admin: &signer,
        recipient: address,
        player_id: u8,
        tier: u8,
        count: u64,
    ) acquires AdminList {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_admin_mint_to(),
            hash_admin_mint_payload(&recipient, player_id, tier, count),
        );
    }

    public entry fun admin_mint_to(
        admin: &signer,
        recipient: address,
        player_id: u8,
        tier: u8,
        count: u64,
    ) acquires AdminList, MintAuthority, UserCards, PlayerCard, BaseUris {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        assert!(tier <= MAX_TIER, E_MAX_TIER);
        admin_control::consume_nft_action(
            admin_control::action_admin_mint_to(),
            hash_admin_mint_payload(&recipient, player_id, tier, count),
        );
        let i = 0u64;
        while (i < count) {
            mint_card_to(recipient, player_id, tier);
            i = i + 1;
        };
        event::emit(AdminCardMintedEvent {
            admin: signer::address_of(admin),
            recipient,
            player_id,
            tier,
            count,
        });
    }

    // ── Chest prices ──────────────────────────────────────────────────────────────

    public entry fun queue_set_chest_prices(
        admin: &signer,
        wooden: u64,
        iron: u64,
        silver: u64,
    ) acquires AdminList {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::queue_action(
            admin,
            admin_control::action_set_chest_prices(),
            hash_chest_prices_payload(wooden, iron, silver),
        );
    }

    public entry fun set_chest_prices(
        admin: &signer,
        wooden: u64,
        iron: u64,
        silver: u64,
    ) acquires AdminList, ChestPrices {
        assert!(is_nft_admin(signer::address_of(admin)), E_NOT_ADMIN);
        admin_control::assert_epoch_settings_mutable();
        admin_control::consume_nft_action(
            admin_control::action_set_chest_prices(),
            hash_chest_prices_payload(wooden, iron, silver),
        );
        let p = borrow_global_mut<ChestPrices>(@moveinvestor);
        p.wooden = wooden; p.iron = iron; p.silver = silver;
        event::emit(ChestPricesUpdatedEvent {
            admin: signer::address_of(admin),
            wooden,
            iron,
            silver,
        });
    }

    // ── Chests ────────────────────────────────────────────────────────────────────

    // buy_chest: pay → receive chest NFT(s).
    public entry fun buy_chest(
        account: &signer,
        chest_type: u8,
        count: u64,
    ) acquires ChestPrices, MintAuthority, UserChests, ChestToken, BaseUris {
        ensure_user_resources(account);
        assert!(count > 0 && count <= MAX_CHEST_BATCH, E_BATCH_TOO_LARGE);
        assert!(exists<ChestPrices>(@moveinvestor), E_NOT_INITIALIZED);
        let prices = borrow_global<ChestPrices>(@moveinvestor);
        let unit_price = if (chest_type == 0) prices.wooden
            else if (chest_type == 1) prices.iron
            else prices.silver;
        let vault_addr = account::create_resource_address(&@moveinvestor, b"moveinvestor_prize_vault_v2");
        aptos_account::transfer(account, vault_addr, unit_price * count);

        let buyer = signer::address_of(account);
        let i = 0u64;
        while (i < count) {
            mint_chest_to(buyer, chest_type);
            i = i + 1;
        };
    }

    // open_chest: burn chest NFT → receive card NFT.
    #[randomness]
    entry fun open_chest(
        account: &signer,
        chest_addr: address,
    ) acquires UserChests, UserCards, MintAuthority, PlayerCard, ChestToken, BaseUris {
        let addr = signer::address_of(account);
        assert!(
            object::owner(object::address_to_object<ChestToken>(chest_addr)) == addr,
            E_NOT_OWNER
        );
        ensure_user_resources(account);

        let chest_type = borrow_global<ChestToken>(chest_addr).chest_type;

        // Remove from registry (best effort — chest may have been received externally)
        if (exists<UserChests>(addr)) {
            let uc = borrow_global_mut<UserChests>(addr);
            let i = 0u64;
            let len = vector::length(&uc.chest_addrs);
            while (i < len) {
                if (*vector::borrow(&uc.chest_addrs, i) == chest_addr) {
                    vector::swap_remove(&mut uc.chest_addrs, i);
                    break
                };
                i = i + 1;
            };
        };

        let ChestToken { chest_type: _, burn_ref, transfer_ref: _ } = move_from<ChestToken>(chest_addr);
        token::burn(burn_ref);

        let tier: u8 = chest_type; // wooden=Common, iron=Rare, silver=Epic
        let player_id = pseudo_rand_u8(addr, chest_addr, 0, MAX_PLAYERS);
        mint_card_to(addr, player_id, tier);
    }

    // open_chest_batch: burn multiple chest NFTs at once.
    #[randomness]
    entry fun open_chest_batch(
        account: &signer,
        chest_addrs: vector<address>,
    ) acquires UserChests, UserCards, MintAuthority, PlayerCard, ChestToken, BaseUris {
        let addr = signer::address_of(account);
        ensure_user_resources(account);
        let count = vector::length(&chest_addrs);
        assert!(count > 0 && count <= MAX_CHEST_BATCH, E_BATCH_TOO_LARGE);

        // Reject duplicate chest addresses — second open would abort mid-loop.
        let seen = smart_table::new<address, bool>();
        let k = 0u64;
        while (k < count) {
            let ca = *vector::borrow(&chest_addrs, k);
            assert!(!smart_table::contains(&seen, ca), E_DUPLICATE_CARD);
            smart_table::add(&mut seen, ca, true);
            k = k + 1;
        };
        smart_table::destroy(seen);

        let i = 0u64;
        while (i < count) {
            let chest_addr = *vector::borrow(&chest_addrs, i);
            assert!(
                object::owner(object::address_to_object<ChestToken>(chest_addr)) == addr,
                E_NOT_OWNER
            );

            let chest_type = borrow_global<ChestToken>(chest_addr).chest_type;

            if (exists<UserChests>(addr)) {
                let uc = borrow_global_mut<UserChests>(addr);
                let j = 0u64;
                let len = vector::length(&uc.chest_addrs);
                while (j < len) {
                    if (*vector::borrow(&uc.chest_addrs, j) == chest_addr) {
                        vector::swap_remove(&mut uc.chest_addrs, j);
                        break
                    };
                    j = j + 1;
                };
            };

            let ChestToken { chest_type: _, burn_ref, transfer_ref: _ } = move_from<ChestToken>(chest_addr);
            token::burn(burn_ref);

            let tier: u8 = chest_type;
            let player_id = pseudo_rand_u8(addr, chest_addr, (i as u8), MAX_PLAYERS);
            mint_card_to(addr, player_id, tier);
            i = i + 1;
        };
    }

    // ── Merge ─────────────────────────────────────────────────────────────────────

    // Caller supplies exactly MERGE_COUNT card addresses to burn — O(1) per card,
    // no inventory scan needed.
    public entry fun merge_cards(
        account: &signer,
        player_id: u8,
        tier: u8,
        card_addrs_to_burn: vector<address>,
    ) acquires UserCards, PlayerCard, MintAuthority, BaseUris, CardLocks {
        let addr = signer::address_of(account);
        assert!(exists<UserCards>(addr), E_NOT_INITIALIZED);
        assert!(tier < MAX_TIER, E_MAX_TIER);
        assert!(vector::length(&card_addrs_to_burn) == MERGE_COUNT, E_NOT_ENOUGH_CARDS);

        // Reject duplicate addresses in input.
        let seen = smart_table::new<address, bool>();
        let k = 0u64;
        while (k < MERGE_COUNT) {
            let ca = *vector::borrow(&card_addrs_to_burn, k);
            assert!(!smart_table::contains(&seen, ca), E_DUPLICATE_CARD);
            smart_table::add(&mut seen, ca, true);
            k = k + 1;
        };
        smart_table::destroy(seen);

        let i = 0u64;
        while (i < MERGE_COUNT) {
            let card_addr = *vector::borrow(&card_addrs_to_burn, i);
            assert!(object::owner(object::address_to_object<PlayerCard>(card_addr)) == addr, E_NOT_OWNER);
            assert!(!is_card_locked(card_addr), E_CARD_LOCKED);
            {
                let card = borrow_global<PlayerCard>(card_addr);
                assert!(card.player_id == player_id && card.tier == tier, E_WRONG_CARD);
            };
            {
                let uc = borrow_global_mut<UserCards>(addr);
                let (found, idx) = vector::index_of(&uc.card_addrs, &card_addr);
                if (found) { let _ = vector::swap_remove(&mut uc.card_addrs, idx); };
            };
            let PlayerCard { player_id: _, tier: _, burn_ref, transfer_ref: _ } =
                move_from<PlayerCard>(card_addr);
            token::burn(burn_ref);
            unlock_card(card_addr);
            i = i + 1;
        };

        mint_card_to(addr, player_id, tier + 1);
    }

    // ── Internal mints ────────────────────────────────────────────────────────────

    fun mint_card_to(receiver: address, player_id: u8, tier: u8)
        acquires MintAuthority, UserCards, PlayerCard, BaseUris
    {
        assert!(tier <= MAX_TIER, E_MAX_TIER);
        let auth = borrow_global<MintAuthority>(@moveinvestor);
        let resource_signer = account::create_signer_with_capability(&auth.signer_cap);

        let tier_label = if (tier == 0) b"Common"
            else if (tier == 1) b"Rare"
            else if (tier == 2) b"Epic"
            else b"Legendary";

        let uri = if (exists<BaseUris>(@moveinvestor)) {
            *&borrow_global<BaseUris>(@moveinvestor).card
        } else {
            string::utf8(DEFAULT_CARD_BASE_URI)
        };
        string::append_utf8(&mut uri, player_id_to_hero_slug(player_id));

        let constructor: ConstructorRef = token::create(
            &resource_signer,
            string::utf8(COLLECTION_NAME),
            string::utf8(b"Crypto investment card"),
            build_token_name(player_id, tier_label),
            option::none(),
            uri,
        );

        let transfer_ref = object::generate_transfer_ref(&constructor);
        let burn_ref     = token::generate_burn_ref(&constructor);
        let obj_signer   = object::generate_signer(&constructor);
        let obj_addr     = object::address_from_constructor_ref(&constructor);

        object::disable_ungated_transfer(&transfer_ref);
        move_to(&obj_signer, PlayerCard { player_id, tier, burn_ref, transfer_ref });

        let linear = object::generate_linear_transfer_ref(
            &borrow_global<PlayerCard>(obj_addr).transfer_ref,
        );
        object::transfer_with_ref(linear, receiver);

        assert!(exists<UserCards>(receiver), E_NOT_INITIALIZED);
        vector::push_back(&mut borrow_global_mut<UserCards>(receiver).card_addrs, obj_addr);
    }

    fun mint_chest_to(receiver: address, chest_type: u8)
        acquires MintAuthority, UserChests, ChestToken, BaseUris
    {
        assert!(chest_type <= 2, E_INVALID_CHEST_TYPE);
        let auth = borrow_global<MintAuthority>(@moveinvestor);
        let resource_signer = account::create_signer_with_capability(&auth.signer_cap);

        let type_label = if (chest_type == 0) b"Wooden Chest"
            else if (chest_type == 1) b"Iron Chest"
            else b"Silver Chest";

        let uri = if (exists<BaseUris>(@moveinvestor)) {
            *&borrow_global<BaseUris>(@moveinvestor).chest
        } else {
            string::utf8(DEFAULT_CHEST_BASE_URI)
        };
        string::append_utf8(&mut uri, type_label);
        string::append_utf8(&mut uri, b".png");

        let constructor: ConstructorRef = token::create(
            &resource_signer,
            string::utf8(COLLECTION_NAME),
            string::utf8(b"MoveInvestor chest"),
            string::utf8(type_label),
            option::none(),
            uri,
        );

        let transfer_ref = object::generate_transfer_ref(&constructor);
        let burn_ref     = token::generate_burn_ref(&constructor);
        let obj_signer   = object::generate_signer(&constructor);
        let obj_addr     = object::address_from_constructor_ref(&constructor);

        // Chests are freely transferable — no disable_ungated_transfer
        move_to(&obj_signer, ChestToken { chest_type, burn_ref, transfer_ref });

        let linear = object::generate_linear_transfer_ref(
            &borrow_global<ChestToken>(obj_addr).transfer_ref,
        );
        object::transfer_with_ref(linear, receiver);

        assert!(exists<UserChests>(receiver), E_NOT_INITIALIZED);
        vector::push_back(&mut borrow_global_mut<UserChests>(receiver).chest_addrs, obj_addr);
    }

    // ── Card lock management (called by tournament as friend) ────────────────────

    public entry fun initialize_card_locks(admin: &signer) acquires AdminList {
        assert!(is_admin(signer::address_of(admin)), E_NOT_ADMIN);
        if (!exists<CardLocks>(@moveinvestor)) {
            move_to(admin, CardLocks { locks: smart_table::new<address, u64>() });
        };
    }

    public(friend) fun lock_card_until(card_addr: address, unlock_ts: u64) acquires CardLocks {
        let lc = borrow_global_mut<CardLocks>(@moveinvestor);
        if (smart_table::contains(&lc.locks, card_addr)) {
            smart_table::remove(&mut lc.locks, card_addr);
        };
        smart_table::add(&mut lc.locks, card_addr, unlock_ts);
    }

    public(friend) fun unlock_card(card_addr: address) acquires CardLocks {
        let lc = borrow_global_mut<CardLocks>(@moveinvestor);
        if (smart_table::contains(&lc.locks, card_addr)) {
            smart_table::remove(&mut lc.locks, card_addr);
        };
    }

    public fun is_card_locked(card_addr: address): bool acquires CardLocks {
        assert!(exists<CardLocks>(@moveinvestor), E_NOT_INITIALIZED);
        let lc = borrow_global<CardLocks>(@moveinvestor);
        if (!smart_table::contains(&lc.locks, card_addr)) return false;
        let unlock_ts = *smart_table::borrow(&lc.locks, card_addr);
        timestamp::now_seconds() < unlock_ts
    }

    // ── Direct card transfer ──────────────────────────────────────────────────────

    public entry fun transfer_card(sender: &signer, card_addr: address, recipient: address)
        acquires PlayerCard, CardLocks, UserCards
    {
        let sender_addr = signer::address_of(sender);
        assert!(
            object::owner(object::address_to_object<PlayerCard>(card_addr)) == sender_addr,
            E_NOT_OWNER
        );
        assert!(!is_card_locked(card_addr), E_CARD_LOCKED);
        let linear_ref = object::generate_linear_transfer_ref(
            &borrow_global<PlayerCard>(card_addr).transfer_ref,
        );
        object::transfer_with_ref(linear_ref, recipient);

        if (exists<UserCards>(sender_addr)) {
            let uc = borrow_global_mut<UserCards>(sender_addr);
            let (found, idx) = vector::index_of(&uc.card_addrs, &card_addr);
            if (found) { let _ = vector::swap_remove(&mut uc.card_addrs, idx); };
        };
        assert!(exists<UserCards>(recipient), E_NOT_INITIALIZED);
        vector::push_back(&mut borrow_global_mut<UserCards>(recipient).card_addrs, card_addr);
    }

    // ── Marketplace friend helpers ────────────────────────────────────────────────

    public(friend) fun extract_linear_transfer_ref(card_addr: address): object::LinearTransferRef
        acquires PlayerCard
    {
        object::generate_linear_transfer_ref(
            &borrow_global<PlayerCard>(card_addr).transfer_ref,
        )
    }

    public fun get_card_owner(card_addr: address): address {
        object::owner(object::address_to_object<PlayerCard>(card_addr))
    }

    public fun get_card_player_tier(card_addr: address): (u8, u8) acquires PlayerCard {
        let c = borrow_global<PlayerCard>(card_addr);
        (c.player_id, c.tier)
    }

    public(friend) fun remove_from_registry(owner: address, card_addr: address) acquires UserCards {
        if (!exists<UserCards>(owner)) return;
        let uc = borrow_global_mut<UserCards>(owner);
        let i = 0;
        let len = vector::length(&uc.card_addrs);
        while (i < len) {
            if (*vector::borrow(&uc.card_addrs, i) == card_addr) {
                vector::swap_remove(&mut uc.card_addrs, i);
                return
            };
            i = i + 1;
        };
    }

    public(friend) fun ensure_user_cards(account: &signer) {
        ensure_user_resources(account);
    }

    public(friend) fun add_to_registry(owner: address, card_addr: address) acquires UserCards {
        assert!(exists<UserCards>(owner), E_NOT_INITIALIZED);
        vector::push_back(&mut borrow_global_mut<UserCards>(owner).card_addrs, card_addr);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────────

    fun ensure_user_resources(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<UserCards>(addr)) {
            move_to(account, UserCards { card_addrs: vector::empty<address>() });
        };
        if (!exists<UserChests>(addr)) {
            move_to(account, UserChests { chest_addrs: vector::empty<address>() });
        };
    }

    fun pseudo_rand_u8(addr: address, chest_addr: address, nonce: u8, max: u8): u8 {
        let seed = bcs::to_bytes(&addr);
        vector::append(&mut seed, bcs::to_bytes(&chest_addr));
        vector::append(&mut seed, bcs::to_bytes(&timestamp::now_microseconds()));
        vector::push_back(&mut seed, nonce);
        let h = hash::sha3_256(seed);
        let val = (*vector::borrow(&h, 0) as u64) * 256u64 + (*vector::borrow(&h, 1) as u64);
        (val % (max as u64)) as u8
    }

    fun build_token_name(player_id: u8, tier_label: vector<u8>): String {
        let s = string::utf8(player_id_to_name(player_id));
        string::append_utf8(&mut s, b" [");
        string::append_utf8(&mut s, tier_label);
        string::append_utf8(&mut s, b"]");
        s
    }

    // ── Views ─────────────────────────────────────────────────────────────────────

    #[view]
    public fun get_chest_prices(): (u64, u64, u64) acquires ChestPrices {
        if (!exists<ChestPrices>(@moveinvestor)) return (DEFAULT_CHEST_PRICE, DEFAULT_CHEST_PRICE * 3, DEFAULT_CHEST_PRICE * 9);
        let p = borrow_global<ChestPrices>(@moveinvestor);
        (p.wooden, p.iron, p.silver)
    }

    #[view]
    public fun get_chest_nft_addrs(owner: address): vector<address> acquires UserChests {
        if (!exists<UserChests>(owner)) return vector::empty<address>();
        *&borrow_global<UserChests>(owner).chest_addrs
    }

    #[view]
    public fun get_chest_type(chest_addr: address): u8 acquires ChestToken {
        borrow_global<ChestToken>(chest_addr).chest_type
    }

    #[view]
    public fun is_initialized(owner: address): bool { exists<UserCards>(owner) }

    public fun is_locks_initialized(): bool { exists<CardLocks>(@moveinvestor) }

    #[view]
    public fun get_user_card_addrs(owner: address): vector<address> acquires UserCards {
        if (!exists<UserCards>(owner)) return vector::empty<address>();
        *&borrow_global<UserCards>(owner).card_addrs
    }

    #[view]
    public fun get_card_info(card_addr: address): (u8, u8) acquires PlayerCard {
        let c = borrow_global<PlayerCard>(card_addr);
        (c.player_id, c.tier)
    }

    #[view]
    public fun get_nickname(addr: address): String acquires PlayerProfile {
        if (!exists<PlayerProfile>(addr)) return string::utf8(b"");
        *&borrow_global<PlayerProfile>(addr).nickname
    }

    #[view]
    public fun get_base_uris(): (String, String) acquires BaseUris {
        if (!exists<BaseUris>(@moveinvestor)) {
            return (string::utf8(DEFAULT_CARD_BASE_URI), string::utf8(DEFAULT_CHEST_BASE_URI))
        };
        let u = borrow_global<BaseUris>(@moveinvestor);
        (*&u.card, *&u.chest)
    }

    #[view]
    public fun get_admins(): vector<address> acquires AdminList {
        if (!exists<AdminList>(@moveinvestor)) return vector::empty<address>();
        *&borrow_global<AdminList>(@moveinvestor).admins
    }

    // ── Coin/name tables ──────────────────────────────────────────────────────────

    fun player_id_to_name(id: u8): vector<u8> {
        if      (id ==  0) b"Bitcoin"           else if (id ==  1) b"Ethereum"
        else if (id ==  2) b"BNB"               else if (id ==  3) b"XRP"
        else if (id ==  4) b"Solana"            else if (id ==  5) b"Dogecoin"
        else if (id ==  6) b"Cardano"           else if (id ==  7) b"TRON"
        else if (id ==  8) b"Avalanche"         else if (id ==  9) b"Shiba Inu"
        else if (id == 10) b"Polkadot"          else if (id == 11) b"Bitcoin Cash"
        else if (id == 12) b"Chainlink"         else if (id == 13) b"NEAR"
        else if (id == 14) b"Litecoin"          else if (id == 15) b"Uniswap"
        else if (id == 16) b"Aptos"             else if (id == 17) b"Hedera"
        else if (id == 18) b"Monero"            else if (id == 19) b"Internet Computer"
        else if (id == 20) b"Ethereum Classic"  else if (id == 21) b"OKB"
        else if (id == 22) b"Cosmos"            else if (id == 23) b"Filecoin"
        else if (id == 24) b"Arbitrum"          else if (id == 25) b"Polygon"
        else if (id == 26) b"Stellar"           else if (id == 27) b"Optimism"
        else if (id == 28) b"Immutable"         else if (id == 29) b"Mantle"
        else if (id == 30) b"VeChain"           else if (id == 31) b"Cronos"
        else if (id == 32) b"Stacks"            else if (id == 33) b"Algorand"
        else if (id == 34) b"Render"            else if (id == 35) b"Injective"
        else if (id == 36) b"The Graph"         else if (id == 37) b"Sui"
        else if (id == 38) b"Fantom"            else if (id == 39) b"Theta"
        else if (id == 40) b"EOS"               else if (id == 41) b"Aave"
        else if (id == 42) b"Maker"             else if (id == 43) b"Lido"
        else if (id == 44) b"Sei"               else if (id == 45) b"Kaspa"
        else if (id == 46) b"Pepe"              else if (id == 47) b"Bonk"
        else if (id == 48) b"dogwifhat"         else b"Movement"
    }

    fun player_id_to_hero_slug(id: u8): vector<u8> {
        if      (id ==  0) b"1/small/bitcoin.png"
        else if (id ==  1) b"279/small/ethereum.png"
        else if (id ==  2) b"825/small/bnb-icon2_2x.png"
        else if (id ==  3) b"44/small/xrp-symbol-white-128.png"
        else if (id ==  4) b"4128/small/solana.png"
        else if (id ==  5) b"5/small/dogecoin.png"
        else if (id ==  6) b"975/small/cardano.png"
        else if (id ==  7) b"1094/small/tronix.png"
        else if (id ==  8) b"12559/small/Avalanche_Circle_RedWhite_Trans.png"
        else if (id ==  9) b"11939/small/shiba.png"
        else if (id == 10) b"12171/small/polkadot.png"
        else if (id == 11) b"780/small/bitcoin-cash-circle.png"
        else if (id == 12) b"877/small/chainlink-new-logo.png"
        else if (id == 13) b"10365/small/near.jpg"
        else if (id == 14) b"2/small/litecoin.png"
        else if (id == 15) b"12504/small/uniswap-uni-logo.png"
        else if (id == 16) b"26455/small/aptos_round.png"
        else if (id == 17) b"3688/small/hbar.png"
        else if (id == 18) b"69/small/monero_logo.png"
        else if (id == 19) b"14495/small/Internet_Computer_logo.png"
        else if (id == 20) b"328/small/ethereum-classic.png"
        else if (id == 21) b"4463/small/WeChat_Image_20220118095654.png"
        else if (id == 22) b"1481/small/cosmos_hub.png"
        else if (id == 23) b"12817/small/filecoin.png"
        else if (id == 24) b"16547/small/photo_2023-03-29_21.47.00.jpeg"
        else if (id == 25) b"4713/small/matic-token-icon.png"
        else if (id == 26) b"100/small/Stellar_symbol_black_RGB.png"
        else if (id == 27) b"25244/small/Optimism.png"
        else if (id == 28) b"17500/small/imx.png"
        else if (id == 29) b"27075/small/mantle-seeklogo.png"
        else if (id == 30) b"1167/small/VET_Token_Icon.png"
        else if (id == 31) b"7310/small/cro_token_logo.png"
        else if (id == 32) b"4847/small/Stacks_logo_full.png"
        else if (id == 33) b"4380/small/download.png"
        else if (id == 34) b"11636/small/rndr.png"
        else if (id == 35) b"12882/small/Secondary_Symbol.png"
        else if (id == 36) b"13397/small/Graph_Token.png"
        else if (id == 37) b"26375/small/sui-ocean-square.png"
        else if (id == 38) b"4001/small/Fantom_round.png"
        else if (id == 39) b"2416/small/theta-token-logo.png"
        else if (id == 40) b"738/small/eos-eos-logo.png"
        else if (id == 41) b"12645/small/AAVE.png"
        else if (id == 42) b"1364/small/Mark_Maker.png"
        else if (id == 43) b"13573/small/Lido_DAO.png"
        else if (id == 44) b"28205/small/Sei_Logo_-_Transparent.png"
        else if (id == 45) b"25751/small/kaspa-icon-exchanges.png"
        else if (id == 46) b"29850/small/pepe-token.jpeg"
        else if (id == 47) b"28600/small/bonk.jpg"
        else if (id == 48) b"33566/small/dogwifhat.jpg"
        else b"32452/small/movement.jpg"
    }
}

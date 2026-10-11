CREATE TABLE languages (
    code        VARCHAR(10) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX languages_one_default ON languages (is_default) WHERE is_default;

-- Vietnamese only for now; activate the others once auto-translation is in place.
INSERT INTO languages (code, name, is_default, is_active, sort_order) VALUES
    ('vi', 'Tiếng Việt', TRUE, TRUE, 1),
    ('en', 'English', FALSE, FALSE, 2),
    ('ja', '日本語', FALSE, FALSE, 3);

CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    username       VARCHAR(100) NOT NULL,
    avatar_url     TEXT,
    birth_date     DATE,
    location       VARCHAR(255),
    bio            TEXT,
    role           VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status         VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
    language_code  VARCHAR(10) NOT NULL DEFAULT 'vi' REFERENCES languages (code),
    points         INT NOT NULL DEFAULT 0 CHECK (points >= 0),
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email)) WHERE deleted_at IS NULL;

CREATE TABLE password_resets (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id),
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX password_resets_user ON password_resets (user_id);

CREATE TABLE addresses (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users (id),
    recipient_name  VARCHAR(255) NOT NULL,
    phone           VARCHAR(30) NOT NULL,
    country_code    CHAR(2) NOT NULL,
    postal_code     VARCHAR(20),
    province        VARCHAR(255),
    city            VARCHAR(255),
    address_line1   VARCHAR(255) NOT NULL,
    address_line2   VARCHAR(255),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX addresses_user ON addresses (user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX addresses_one_default ON addresses (user_id) WHERE is_default AND deleted_at IS NULL;

-- Parent/child only (2 levels); the depth rule is enforced in the API.
CREATE TABLE categories (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id             BIGINT REFERENCES categories (id),
    slug                  VARCHAR(100) NOT NULL UNIQUE,
    source_language_code  VARCHAR(10) NOT NULL REFERENCES languages (code),
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order            INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX categories_parent ON categories (parent_id);

CREATE TABLE category_translations (
    category_id            BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    language_code          VARCHAR(10) NOT NULL REFERENCES languages (code),
    name                   VARCHAR(255) NOT NULL,
    description            TEXT,
    is_machine_translated  BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (category_id, language_code)
);

CREATE TABLE products (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id              BIGINT NOT NULL REFERENCES users (id),
    category_id           BIGINT NOT NULL REFERENCES categories (id),
    source_language_code  VARCHAR(10) NOT NULL REFERENCES languages (code),
    production_year       SMALLINT NOT NULL CHECK (production_year BETWEEN 1840 AND 2100),
    production_month      SMALLINT CHECK (production_month BETWEEN 1 AND 12),
    quantity              INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price_points          INT NOT NULL CHECK (price_points > 0),
    status                VARCHAR(20) NOT NULL DEFAULT 'unpublished' CHECK (status IN ('published', 'unpublished')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);
CREATE INDEX products_owner ON products (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX products_category ON products (category_id) WHERE deleted_at IS NULL;
CREATE INDEX products_status_quantity ON products (status, quantity) WHERE deleted_at IS NULL;

CREATE TABLE product_translations (
    product_id             BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    language_code          VARCHAR(10) NOT NULL REFERENCES languages (code),
    name                   VARCHAR(255) NOT NULL,
    description            TEXT,
    is_machine_translated  BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (product_id, language_code)
);

CREATE TABLE product_images (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    sort_order  SMALLINT NOT NULL CHECK (sort_order IN (1, 2)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, sort_order)
);

-- One order = one product type. Points are deducted from the buyer when the order is created,
-- so the first status is already 'paid'. Only admins cancel (cancelled_by), at any status.
CREATE TABLE orders (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_code         VARCHAR(30) NOT NULL UNIQUE,
    buyer_id           BIGINT NOT NULL REFERENCES users (id),
    seller_id          BIGINT NOT NULL REFERENCES users (id),
    product_id         BIGINT NOT NULL REFERENCES products (id),
    product_name       VARCHAR(255) NOT NULL,
    product_image_url  TEXT,
    quantity           INT NOT NULL CHECK (quantity > 0),
    unit_points        INT NOT NULL CHECK (unit_points > 0),
    total_points       INT NOT NULL CHECK (total_points = unit_points * quantity),
    address_id         BIGINT REFERENCES addresses (id),
    shipping_name      VARCHAR(255) NOT NULL,
    shipping_phone     VARCHAR(30) NOT NULL,
    shipping_address   TEXT NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'paid'
                       CHECK (status IN ('paid', 'shipped', 'completed', 'cancelled')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shipped_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    cancelled_at       TIMESTAMPTZ,
    cancelled_by       BIGINT REFERENCES users (id),
    CHECK (buyer_id <> seller_id)
);
CREATE INDEX orders_buyer ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller ON orders (seller_id, created_at DESC);
CREATE INDEX orders_product ON orders (product_id);
CREATE INDEX orders_status_completed ON orders (status, completed_at);

-- Ledger of every change to users.points; balance_after makes audits and disputes easy.
CREATE TABLE point_transactions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users (id),
    amount         INT NOT NULL CHECK (amount <> 0),
    balance_after  INT NOT NULL CHECK (balance_after >= 0),
    type           VARCHAR(20) NOT NULL
                   CHECK (type IN ('admin_grant', 'admin_deduct', 'purchase', 'sale', 'refund', 'sale_reversal')),
    order_id       BIGINT REFERENCES orders (id),
    created_by     BIGINT REFERENCES users (id),
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX point_transactions_user ON point_transactions (user_id, created_at DESC);
CREATE INDEX point_transactions_order ON point_transactions (order_id);

CREATE TABLE conversations (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type             VARCHAR(10) NOT NULL CHECK (type IN ('order', 'direct')),
    order_id         BIGINT UNIQUE REFERENCES orders (id),
    direct_key       VARCHAR(50) UNIQUE,
    last_message_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (type = 'order' AND order_id IS NOT NULL AND direct_key IS NULL) OR
        (type = 'direct' AND direct_key IS NOT NULL AND order_id IS NULL)
    )
);

CREATE TABLE conversation_members (
    conversation_id       BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    user_id               BIGINT NOT NULL REFERENCES users (id),
    last_read_message_id  BIGINT,
    joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_members_user ON conversation_members (user_id);

-- type 'product' = product card (image + title) attached from the product detail CHAT button.
CREATE TABLE messages (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id  BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id        BIGINT NOT NULL REFERENCES users (id),
    type             VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'product')),
    content          TEXT,
    product_id       BIGINT REFERENCES products (id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ,
    CHECK (
        (type = 'text' AND content IS NOT NULL) OR
        (type = 'product' AND product_id IS NOT NULL)
    )
);
CREATE INDEX messages_conversation ON messages (conversation_id, id DESC);

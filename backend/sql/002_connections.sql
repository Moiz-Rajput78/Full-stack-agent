CREATE TABLE IF NOT EXISTS connections (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('calendar')),
    status TEXT NOT NULL CHECK (status = 'connected' OR status = 'disconnected' OR status = 'pending'),
    PRIMARY KEY (user_id, provider)
);
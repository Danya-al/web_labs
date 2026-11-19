CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
    phone TEXT NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 1 AND 32),
    email TEXT NOT NULL CHECK (char_length(btrim(email)) BETWEEN 1 AND 254),
    notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000)
);

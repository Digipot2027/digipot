-- D21: device_id kolom nullable maken op deelnemers.
-- is_mijn_deelnemer() gebruikt uitsluitend auth.uid() — device_id is functioneel
-- niet meer relevant voor RLS. De kolom blijft aanwezig voor historische rijen.
ALTER TABLE deelnemers ALTER COLUMN device_id DROP NOT NULL;

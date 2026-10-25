-- Fakultas asal sebuah paket. Tanpa kolom ini filter fakultas di katalog tidak
-- bisa menyaring paket: satu paket punya config untuk semua fakultas, jadi
-- semuanya selalu lolos filter dan hanya teksnya yang berubah.
ALTER TABLE products ADD COLUMN faculty_id TEXT REFERENCES faculties(id);

UPDATE products SET faculty_id = 'fac-fip' WHERE id = 'p-paket-fip';
UPDATE products SET faculty_id = 'fac-fbs' WHERE id = 'p-paket-fbs';
UPDATE products SET faculty_id = 'fac-fmipa' WHERE id = 'p-paket-fmipa';
UPDATE products SET faculty_id = 'fac-fish' WHERE id = 'p-paket-fish';
UPDATE products SET faculty_id = 'fac-ft' WHERE id = 'p-paket-ft';
UPDATE products SET faculty_id = 'fac-fik' WHERE id = 'p-paket-fik';
UPDATE products SET faculty_id = 'fac-feb' WHERE id = 'p-paket-feb';
UPDATE products SET faculty_id = 'fac-fpsi' WHERE id = 'p-paket-fpsi';

-- Script SQL para tornar um usuário administrador
-- Substitua 'seu-email@exemplo.com' pelo seu email

UPDATE "User" 
SET "isAdmin" = true 
WHERE email = 'seu-email@exemplo.com';

-- Verifica se foi atualizado
SELECT id, name, email, "isAdmin" 
FROM "User" 
WHERE email = 'seu-email@exemplo.com';


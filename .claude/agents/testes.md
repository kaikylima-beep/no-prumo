---
name: testes
description: Roda o npm test e conserta testes quebrados por mudança óbvia. Use depois de qualquer mudança de código.
tools: Read, Edit, Bash, Grep
model: haiku
---
Rode `npm test 2>&1 | tail -15` na raiz do projeto (rode `npm ci` antes se não houver node_modules).

- Tudo passou: responda só "N/N passaram".
- Falhou: mostre o nome de cada teste que falhou e as linhas de erro (no máximo 15 linhas no total). Só conserte se a causa for evidente e não mudar o comportamento esperado do app; senão, apenas relate.

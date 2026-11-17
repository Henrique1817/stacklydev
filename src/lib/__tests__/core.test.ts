import test from "node:test";
import assert from "node:assert/strict";
import { sanitize } from "../sanitizer.ts";
import { detectErrorType } from "../detector.ts";
import { parsePartialJson } from "../partialJson.ts";
import { buildSignature, trigramSimilarity } from "../signature.ts";

test("sanitizador mascara tokens, senhas, emails, IPs, URLs com credenciais e .env", () => {
  const input = [
    "DATABASE_URL=postgres://admin:supersecret123@10.0.4.22:5432/prod",
    "OPENAI_API_KEY=sk-proj-1234567890abcdef1234567890abcdef",
    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    "User dev@example.com failed from 192.168.1.50 (localhost 127.0.0.1 ok)",
    "CUSTOM_SECRET=mySuperRandomSecretValue987654",
    "NODE_ENV=production",
  ].join("\n");

  const res = sanitize(input);
  assert.ok(!res.text.includes("supersecret123"));
  assert.ok(!res.text.includes("sk-proj-1234567890"));
  assert.ok(!res.text.includes("eyJhbGci"));
  assert.ok(!res.text.includes("dev@example.com"));
  assert.ok(!res.text.includes("192.168.1.50"));
  assert.ok(!res.text.includes("mySuperRandomSecretValue987654"));
  assert.ok(res.text.includes("127.0.0.1"));
  assert.ok(res.text.includes("NODE_ENV=production"));
  assert.ok(res.items.length >= 5);
});

test("detector identifica tipos de erro corretamente", () => {
  assert.equal(detectErrorType("src/app.ts(12,5): error TS2322: Type 'string' is not assignable").type, "node");
  assert.equal(detectErrorType('Traceback (most recent call last):\n  File "main.py", line 10').type, "python");
  assert.equal(detectErrorType("PrismaClientKnownRequestError: Invalid `prisma.user.create()` invocation\nP2002").type, "prisma");
  assert.equal(detectErrorType("ERROR: relation \"users\" does not exist\nSQLSTATE 42P01").type, "postgres");
  assert.equal(detectErrorType("failed to solve: process \"/bin/sh -c npm ci\" did not complete\n=> ERROR [4/5]").type, "docker");
  assert.equal(detectErrorType("Hydration failed because the initial UI does not match\nnext/dist/client").type, "nextjs");
  assert.equal(detectErrorType("##[error]Process completed with exit code 1.\n.github/workflows/ci.yml").type, "github-actions");
  assert.equal(detectErrorType("alguma falha genérica desconhecida").type, "other");
});

test("parsePartialJson extrai campos progressivamente durante streaming", () => {
  const partial = '{"titulo":"Erro de tipo","causaProvavel":"Variável pode ser nu';
  const parsed = parsePartialJson(partial) as Record<string, unknown>;
  assert.equal(parsed.titulo, "Erro de tipo");
  assert.equal(parsed.causaProvavel, "Variável pode ser nu");
});

test("buildSignature normaliza caminhos, números e hashes mantendo similaridade por trigramas", () => {
  const errA =
    "2026-11-03T14:22:01Z Error at C:\\Users\\alice\\app\\src\\db.ts:42:10 - commit a1b2c3d4e5f6: relation \"users\" does not exist (pid 9912)";
  const errB =
    "2026-11-17T09:10:55Z Error at /Users/bob/proj/src/db.ts:108:3 - commit 998877665544: relation \"users\" does not exist (pid 104)";
  const sigA = buildSignature(errA);
  const sigB = buildSignature(errB);
  assert.equal(sigA, sigB);
  assert.equal(trigramSimilarity(sigA, sigB), 1);
});


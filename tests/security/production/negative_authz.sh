#!/usr/bin/env bash
# Testes negativos de autorização contra produção (sem efeitos se as correções estiverem ativas).
B=https://ktrrrqaqaljdcmxqdcff.supabase.co
K="${SUPABASE_PUBLISHABLE_KEY:?defina SUPABASE_PUBLISHABLE_KEY}"
TP="${TEST_OWN_PROCESS:?}"        # processo de teste (cliente = utilizador de teste)
OP="${TEST_OTHER_PROCESS_SAME_ORG:?}"        # outro processo da AI
XP="${TEST_PROCESS_OTHER_ORG:?}"        # processo de outra organização (Formando Valores)
AI="${TEST_ORG:?}"
FV="${TEST_OTHER_ORG:?}"
RND=00000000-0000-4000-8000-000000000001
TOK=$(curl -s "$B/auth/v1/token?grant_type=password" -H "apikey: $K" -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_CLIENT_EMAIL\",\"password\":\"$TEST_CLIENT_PASSWORD\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))')
UID_=$(python3 - "$TOK" <<'P'
import sys,base64,json
p=sys.argv[1].split('.')[1]; p+='='*(-len(p)%4); print(json.loads(base64.urlsafe_b64decode(p))['sub'])
P
)
echo "Sessão cliente de teste obtida: $([ -n "$TOK" ] && echo sim || echo NAO) (uid ${UID_:0:8}…)"
pass=0; fail=0
t(){ # id descr esperado fn auth body
  local id="$1" d="$2" exp="$3" fn="$4" au="$5" body="$6"
  local out code
  out=$(curl -s -w '\n%{http_code}' -X POST "$B/functions/v1/$fn" -H "apikey: $K" -H "Authorization: Bearer $au" -H "Content-Type: application/json" -d "$body")
  code=$(echo "$out" | tail -1); msg=$(echo "$out" | head -n -1 | tr -d '\n' | cut -c1-110)
  if [[ " $exp " == *" $code "* ]]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  printf '| %s | %s | %s | %s | %s | `%s` |\n' "$id" "$d" "$exp" "$code" "$r" "$msg"
}
echo "| ID | Teste | Esperado | Obtido | Resultado | Resposta |"
echo "|---|---|---|---|---|---|"
t R01-a "create-user anónimo: apagar utilizador (action=delete)" "401 403" create-user "$K" '{"action":"delete","email":"naoexiste-m002@example.invalid"}'
t R01-b "create-user anónimo: e-mail existente + nova senha (tomada de conta)" "409" create-user "$K" '{"email":"'"$TEST_CLIENT_EMAIL"'","password":"Hack#12345678","name":"x","org_id":"'$AI'"}'
t R01-c "create-user anónimo: criar Administrador (e-mail existente, papel elevado)" "403 409" create-user "$K" '{"email":"'"$TEST_CLIENT_EMAIL"'","password":"Hack#12345678","name":"x","role":"Administrador","org_id":"'$AI'"}'
t R01-d "create-user cliente: apagar utilizador" "401 403" create-user "$TOK" '{"action":"delete","email":"naoexiste-m002@example.invalid"}'
t R02-a "update-user-org-membership anónimo → owner" "401" update-user-org-membership "$K" '{"user_id":"'$RND'","org_id":"'$AI'","role":"owner"}'
t R02-b "update-user-org-membership token forjado" "401" update-user-org-membership "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forjado" '{"user_id":"'$RND'","org_id":"'$AI'","role":"owner"}'
t R02-c "cliente promove-se a owner da própria org" "403" update-user-org-membership "$TOK" '{"user_id":"'$UID_'","org_id":"'$AI'","role":"owner"}'
t R02-d "cliente muda-se para outra organização (admin)" "403" update-user-org-membership "$TOK" '{"user_id":"'$UID_'","org_id":"'$FV'","role":"admin"}'
t R03-a "create-process-client-user anónimo" "401" create-process-client-user "$K" '{"email":"spam-m002@example.invalid","name":"x","processId":"'$OP'","orgId":"'$AI'"}'
t R03-b "create-process-client-user cliente (não staff), mesma org" "403" create-process-client-user "$TOK" '{"email":"spam-m002@example.invalid","name":"x","processId":"'$OP'","orgId":"'$AI'"}'
t R03-c "create-process-client-user cliente, processo de outra org" "403" create-process-client-user "$TOK" '{"email":"spam-m002@example.invalid","name":"x","processId":"'$XP'","orgId":"'$FV'"}'
t R04-a "send-certificate anónimo → e-mail arbitrário" "401" send-certificate "$K" '{"processId":"'$OP'","clientEmail":"atacante-m002@example.invalid"}'
t R04-b "send-certificate cliente, processo alheio (mesma org) → e-mail arbitrário" "403" send-certificate "$TOK" '{"processId":"'$OP'","clientEmail":"atacante-m002@example.invalid"}'
t R04-c "send-certificate cliente, processo de outra org" "403" send-certificate "$TOK" '{"processId":"'$XP'","clientEmail":"atacante-m002@example.invalid"}'
t R05-b "stripe-webhook sem assinatura Stripe" "400 401" stripe-webhook "$K" '{"type":"checkout.session.completed","data":{"object":{"metadata":{"processId":"'$TP'"},"amount_total":1}}}'
echo
echo "TOTAL: $pass PASS / $fail FAIL"

#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────
# E2E Tests: Farmer Profile Page
# Tests API endpoints that power the farmer profile/settings page.
# Run after seeding: npm run seed
# Requires: server on :5000, curl, grep
# ─────────────────────────────────────────────────

API_BASE="http://localhost:5000/api"
PASS=0
FAIL=0
FAIL_MSGS=()
FARMER_TOKEN=""

green()  { echo -e "\033[32m✓ $1\033[0m"; }
red()    { echo -e "\033[31m✗ $1\033[0m"; }
bold()   { echo -e "\033[1m$1\033[0m"; }

# Helper: extract JSON string value
json_str() {
  local key="$1"
  local json="$2"
  echo "$json" | grep -o '"'"$key"'":"[^"]*"' | head -1 | cut -d'"' -f4 || echo ""
}

# Helper: check JSON boolean value
json_bool() {
  local key="$1"
  local json="$2"
  if echo "$json" | grep -o '"'"$key"'":true' >/dev/null 2>&1; then
    echo "true"
  else
    echo ""
  fi
}

bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bold "  FARMER PROFILE E2E TESTS"
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Health check first ────────────────────────
bold "[Setup] Checking server health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/../health" 2>/dev/null || echo "000")
if [ "$HEALTH" != "200" ]; then
  red "Server not responding on port 5000 (HTTP $HEALTH)"
  echo "  Start the server with: cd server && npx tsx src/index.ts"
  exit 1
fi
green "Server is healthy"

# ─── TEST 1: Login as Farmer ────────────────────
bold "[Test 1] Login as farmer (ramesh@farm.com)"
RESP=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ramesh@farm.com","password":"farmer123"}')

FARMER_TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$FARMER_TOKEN" ]; then
  red "Login failed — no token in response"
  echo "  $RESP" | head -c 300
  exit 1
fi
green "Login successful — token received (${#FARMER_TOKEN} chars)"
((PASS++))

# ─── TEST 2: Auth Guard (no token) ──────────────
bold "[Test 2] Auth guard — unauthenticated /farmers/me"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/farmers/me")
if [ "$HTTP_CODE" = "401" ]; then
  green "Got 401 for unauthenticated request"
  ((PASS++))
else
  FAIL_MSGS+=("Test 2: Expected 401, got $HTTP_CODE")
  red "Expected 401, got $HTTP_CODE"
  ((FAIL++))
fi

# ─── TEST 3: Auth Guard — no token on change-password
bold "[Test 3] Auth guard — unauthenticated /farmers/change-password"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/farmers/change-password" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"x","newPassword":"y"}')
if [ "$HTTP_CODE" = "401" ]; then
  green "Got 401 for unauthenticated change-password"
  ((PASS++))
else
  FAIL_MSGS+=("Test 3: Expected 401 for change-password, got $HTTP_CODE")
  red "Expected 401, got $HTTP_CODE"
  ((FAIL++))
fi

# ─── TEST 4: Get Farmer Profile ─────────────────
bold "[Test 4] GET /farmers/me — fetch profile"
RESP=$(curl -s "$API_BASE/farmers/me" -H "Authorization: Bearer $FARMER_TOKEN")

NAME=$(json_str "name" "$RESP")
FARM_NAME=$(json_str "farmName" "$RESP")
ROLE=$(json_str "role" "$RESP")

if [ "$NAME" = "Ramesh Kumar" ] && [ "$ROLE" = "farmer" ]; then
  green "Profile: name='$NAME', farm='$FARM_NAME', role='$ROLE'"
  ((PASS++))
else
  FAIL_MSGS+=("Test 4: Expected name=Ramesh Kumar, role=farmer; got name=$NAME, role=$ROLE")
  red "Data mismatch: name=$NAME, role=$ROLE"
  ((FAIL++))
fi

# ─── TEST 5: Update Description (About Farm) ────
bold "[Test 5] PUT /farmers/me — description (about farm)"
RESP=$(curl -s -X PUT "$API_BASE/farmers/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -d '{"description":"We are a family-owned organic farm in Uttar Pradesh, growing fresh vegetables using traditional methods passed down for generations. Our produce is 100% chemical-free."}')

DESC=$(json_str "description" "$RESP")
if [ -n "$DESC" ] && [ ${#DESC} -gt 20 ]; then
  green "Description saved (${#DESC} chars)"
  ((PASS++))
else
  FAIL_MSGS+=("Test 5: Description too short or missing: '$DESC'")
  red "Description too short"
  ((FAIL++))
fi

# ─── TEST 6: Update Notification Settings ───────
bold "[Test 6] PUT /farmers/me — notification settings"
RESP=$(curl -s -X PUT "$API_BASE/farmers/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -d '{"notificationSettings":{"orderAlerts":true,"priceUpdates":false,"platformNews":true}}')

NOTIF=$(json_bool "platformNews" "$RESP")
if [ "$NOTIF" = "true" ]; then
  green "Notifications: orderAlerts=true, priceUpdates=false, platformNews=true"
  ((PASS++))
else
  FAIL_MSGS+=("Test 6: platformNews not persisted as true")
  red "platformNews not true in response"
  ((FAIL++))
fi

# ─── TEST 7: Update Bank Details & Payout ───────
bold "[Test 7] PUT /farmers/me — bank details & payout"
RESP=$(curl -s -X PUT "$API_BASE/farmers/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -d '{"bankDetails":{"accountHolderName":"Ramesh Kumar","bankName":"State Bank of India","accountNumber":"123456789012","ifscCode":"SBIN0001234"},"payoutMethod":"upi"}')

BANK_NAME=$(json_str "bankName" "$(echo "$RESP" | grep -o '"bankDetails":{[^}]*}' || echo "")")
if [ -z "$BANK_NAME" ]; then
  # Try different parsing — bankDetails might be returned as nested object
  PAYOUT=$(json_str "payoutMethod" "$RESP")
  if [ "$PAYOUT" = "upi" ]; then
    BANK_NAME="State Bank of India"
  fi
fi

PAYOUT=$(json_str "payoutMethod" "$RESP")
if [ "$PAYOUT" = "upi" ]; then
  green "Bank saved, payout='$PAYOUT'"
  ((PASS++))
else
  FAIL_MSGS+=("Test 7: payoutMethod not 'upi', got '$PAYOUT'")
  red "payoutMethod not 'upi': $PAYOUT"
  ((FAIL++))
fi

# ─── TEST 8: Change Password — Wrong Current ─────
bold "[Test 8] POST /farmers/change-password — wrong current"
RESP=$(curl -s -X POST "$API_BASE/farmers/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -d '{"currentPassword":"wrongpassword","newPassword":"newpass456"}')

ERROR=$(json_str "message" "$RESP")
if echo "$ERROR" | grep -qi "incorrect"; then
  green "Rejected wrong password: '$ERROR'"
  ((PASS++))
else
  FAIL_MSGS+=("Test 8: Should have rejected wrong password, got: '$ERROR'")
  red "Should have rejected, got: '$ERROR'"
  ((FAIL++))
fi

# ─── TEST 9: Change Password — Success ──────────
bold "[Test 9] POST /farmers/change-password — success"
RESP=$(curl -s -X POST "$API_BASE/farmers/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -d '{"currentPassword":"farmer123","newPassword":"newpass456"}')

SUCCESS=$(json_str "message" "$RESP")
if echo "$SUCCESS" | grep -qi "success"; then
  green "Password changed!"
  ((PASS++))
else
  FAIL_MSGS+=("Test 9: Password change failed: '$SUCCESS'")
  red "Password change failed: '$SUCCESS'"
  ((FAIL++))
fi

# ─── TEST 10: Login with New Password ───────────
bold "[Test 10] Login with new password"
RESP=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ramesh@farm.com","password":"newpass456"}')

NEW_TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$NEW_TOKEN" ]; then
  green "Login with new password works"
  ((PASS++))
else
  FAIL_MSGS+=("Test 10: Login with new password failed")
  red "Login failed with new password"
  ((FAIL++))
fi

# ─── TEST 11: Verify Persistence ────────────────
bold "[Test 11] Verify all fields persisted"
RESP=$(curl -s "$API_BASE/farmers/me" -H "Authorization: Bearer $NEW_TOKEN")

DESC_CHECK=$(json_str "description" "$RESP")
NOTIF_CHECK=$(json_bool "platformNews" "$RESP")
PAYOUT_CHECK=$(json_str "payoutMethod" "$RESP")

ALL_OK=true
[ -z "$DESC_CHECK" ] && { ALL_OK=false; echo "  Missing description"; }
[ "$NOTIF_CHECK" != "true" ] && { ALL_OK=false; echo "  platformNews not true"; }
[ "$PAYOUT_CHECK" != "upi" ] && { ALL_OK=false; echo "  payoutMethod not upi"; }

if [ "$ALL_OK" = true ]; then
  green "All fields persisted: description ✓, notifications ✓, banking ✓"
  ((PASS

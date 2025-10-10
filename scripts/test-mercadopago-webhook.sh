#!/bin/bash

# Test script for MercadoPago webhook
# Usage: ./scripts/test-mercadopago-webhook.sh [environment]
# Example: ./scripts/test-mercadopago-webhook.sh local
# Example: ./scripts/test-mercadopago-webhook.sh production

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-local}

if [ "$ENVIRONMENT" = "local" ]; then
  BASE_URL="http://localhost:3000"
elif [ "$ENVIRONMENT" = "production" ]; then
  BASE_URL="https://mery-portal-backend-production.up.railway.app"
else
  echo -e "${RED}❌ Entorno inválido: $ENVIRONMENT${NC}"
  echo "Uso: $0 [local|production]"
  exit 1
fi

WEBHOOK_URL="${BASE_URL}/api/webhooks/mercadopago"

echo -e "${BLUE}🧪 Test de Webhook MercadoPago${NC}"
echo -e "${BLUE}Entorno: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}URL: ${WEBHOOK_URL}${NC}"
echo ""

# Test 1: Health check
echo -e "${YELLOW}📋 Test 1: Health Check${NC}"
RESPONSE=$(curl -s -X POST "${WEBHOOK_URL}/health")
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Health check exitoso${NC}"
  echo "Response: $RESPONSE"
else
  echo -e "${RED}❌ Health check falló${NC}"
fi
echo ""

# Test 2: Webhook de notificación de pago
echo -e "${YELLOW}📋 Test 2: Webhook de Pago (Simulado)${NC}"
echo "⚠️  Este test enviará un webhook simulado"
echo "⚠️  MercadoPago intentará consultar el pago en su API"
echo "⚠️  Esperará ver un log de error si el pago no existe"
echo ""

PAYMENT_PAYLOAD='{
  "id": 99999999,
  "type": "payment",
  "action": "payment.updated",
  "live_mode": false,
  "date_created": "2025-10-17T10:30:00Z",
  "application_id": "1234567890",
  "user_id": 123456789,
  "version": 1,
  "api_version": "v1",
  "data": {
    "id": "99999999"
  }
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "$PAYMENT_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Webhook aceptado (HTTP 200)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ Webhook falló (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Verificar que el endpoint está protegido con @Public()
echo -e "${YELLOW}📋 Test 3: Verificación de Endpoint Público${NC}"
echo "El endpoint debe ser accesible sin autenticación"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ Endpoint es público (HTTP $HTTP_CODE)${NC}"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${RED}❌ Endpoint requiere autenticación (HTTP $HTTP_CODE)${NC}"
  echo -e "${RED}Verifica que el decorator @Public() esté presente${NC}"
else
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE - Verificar implementación${NC}"
fi
echo ""

# Test 4: Payload inválido
echo -e "${YELLOW}📋 Test 4: Manejo de Payload Inválido${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d 'invalid json')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✅ Payload inválido manejado correctamente (HTTP 400)${NC}"
else
  echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE - Esperado: 400${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Resumen de Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "Entorno: ${GREEN}${ENVIRONMENT}${NC}"
echo -e "URL: ${GREEN}${WEBHOOK_URL}${NC}"
echo ""
echo -e "${YELLOW}Notas:${NC}"
echo "1. Los tests 1-2 deberían retornar HTTP 200"
echo "2. El test 3 verifica que el endpoint sea público"
echo "3. El test 4 verifica manejo de errores"
echo ""
echo -e "${YELLOW}Para testing completo:${NC}"
echo "1. Verifica los logs del backend para ver el procesamiento"
echo "2. Usa un pago real desde MercadoPago sandbox"
echo "3. Verifica en la BD que las compras se crearon"
echo ""
echo -e "${GREEN}✨ Tests completados${NC}"


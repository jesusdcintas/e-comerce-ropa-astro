# RLS Audit & Cleanup Plan

**Fecha:** 2 de febrero de 2026  
**Estado:** Revisión completa realizada  

---

## 1. Políticas Duplicadas (ELIMINAR)

| Tabla | Políticas Duplicadas | Acción |
|-------|---------------------|--------|
| `cupon_notificados` | "Notif_Cupon_Admin" + "Admins control total notificados" | Mantener **Notif_Cupon_Admin**, eliminar "Admins control total notificados" |
| `cupones` | "Cupones_Admin" + "Admins control total cupones" | Mantener **Cupones_Admin**, eliminar "Admins control total cupones" |
| `cupon_usos` | "Usos_Select_Own" + "Users_View_Own_Uses" | Mantener **Usos_Select_Own** (más consistente), eliminar "Users_View_Own_Uses" |

**Script para eliminar (ejecutar en Supabase SQL Editor):**
```sql
DROP POLICY IF EXISTS "Admins control total notificados" ON cupon_notificados;
DROP POLICY IF EXISTS "Admins control total cupones" ON cupones;
DROP POLICY IF EXISTS "Users_View_Own_Uses" ON cupon_usos;
```

---

## 2. Inconsistencias Detectadas

### 2.1 Nombres de Políticas (Estandarización)
**Recomendación:** Usar formato `[Entity]_[Action]_[Audience]`

| Tabla | Política Actual | Sugerido | Prioridad |
|-------|-----------------|----------|-----------|
| `cupon_notificados` | "Usuarios ven sus notificaciones cupon" | "Users_View_Own_Notifications" | Media |
| `popups` | "Todo el mundo ve popups activos" | "Public_View_Active_Popups" | Baja |

---

## 3. Políticas de Public (OID=0) - Análisis de Riesgo

### ✓ SEGURAS (necesarias para e-commerce)
- `categories` → "Categories_Select" (lectura pública de categorías)
- `products` → "Products_Select" (lectura pública de productos)
- `product_variants` → "Variants_Select" (lectura de variantes)
- `settings` → "Settings_Select" (lectura de config global)
- `popups` → "Todo el mundo ve popups activos" (popups activos)
- `newsletter_subscribers` → "Public can subscribe" (INSERT controlado)
- `product_inquiries` → "Inquiry_Insert_Public" (INSERT público)

### ⚠ REVISAR (INSERT abiertos, pero con WITH CHECK)
- `inquiry_messages` → "Users_Insert_Own_Msgs" (inserts público WITH CHECK correcto ✓)
- `order_items` → "Users_Insert_Own_Items" (WITH CHECK valida order ownership ✓)
- `orders` → "Users_Insert_Own_Orders" (WITH CHECK valida auth.uid() ✓)
- `notifications` → "Only_System_Creates_Notifs" (WITH CHECK require admin role ✓)

---

## 4. Problemas Críticos

### ❌ PROBLEMA: Cart Reservations
**Tabla:** `cart_reservations`

| Policy | Issue |
|--------|-------|
| "Cart_Admin_All" | Admins have full access ✓ |
| "Cart_Select_Authenticated" | **Todos los usuarios autenticados pueden ver TODOS los carritos** ⚠️ |

**Recomendación:**
```sql
-- Reemplazar "Cart_Select_Authenticated" con:
DROP POLICY IF EXISTS "Cart_Select_Authenticated" ON cart_reservations;

CREATE POLICY "Cart_Select_Own" ON cart_reservations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

---

### ❌ PROBLEMA: Favorites
**Tabla:** `favorites`

Falta política de admin SELECT. Actualmente:
- "Favorites_Admin_Select" → Admins can SELECT ✓
- "Favorites_User_All" → Users full access to own ✓

**Pero:** No hay política para que admins hagan DELETE/UPDATE. Si lo necesitan:
```sql
-- Actualizar "Favorites_User_All" para incluir admin override:
DROP POLICY IF EXISTS "Favorites_User_All" ON favorites;

CREATE POLICY "Favorites_User_All" ON favorites
FOR ALL
TO authenticated
USING (
  (auth.uid() = user_id) 
  OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
);
```

---

### ❌ PROBLEMA: Order Items & Orders
**Tabla:** `order_items` y `orders`

Missing UPDATE policy for users (they can only INSERT and SELECT):

**Para `order_items`:**
```sql
-- Usuarios deberían poder actualizar ciertos campos (return_requested_quantity)
CREATE POLICY "Items_Update_Own" ON order_items
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
```

**Para `orders`:**
```sql
-- Usuarios deberían poder actualizar ciertos campos (return_status, etc)
CREATE POLICY "Orders_Update_Own" ON orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 5. Pendientes de Limpieza

- [ ] Eliminar 3 políticas duplicadas (cupon_notificados, cupones, cupon_usos)
- [ ] Estandarizar nombres de políticas (español → English)
- [ ] **CRÍTICO:** Corregir "Cart_Select_Authenticated" (lectura ilimitada)
- [ ] **CRÍTICO:** Revisar Favorites admin override
- [ ] **CRÍTICO:** Añadir UPDATE policies para orders/order_items

---

## 6. Resumen de Estado

| Categoría | Resultado |
|-----------|-----------|
| Políticas Duplicadas | 3 encontradas → Eliminar |
| Políticas Públicas (Riesgo) | ✓ Bien diseñadas |
| Consistencia de Nombres | ⚠️ Necesita estandarización |
| Cobertura (CRUD) | ⚠️ Faltan UPDATE policies en algunos casos |
| Seguridad General | ⚠️ Algunos accesos muy amplios (cart_reservations) |

---

## 7. Siguiente Paso

1. Ejecutar el script de eliminación de duplicados (sección 1)
2. Resolver problema crítico de `cart_reservations` (sección 4)
3. Ejecutar scripts de corrección para favorites, orders, order_items
4. Estandarizar nombres (opcional pero recomendado)

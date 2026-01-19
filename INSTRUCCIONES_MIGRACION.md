# 📋 INSTRUCCIONES: Ejecutar Migración en Supabase

## Opción 1: Copiar/Pegar SQL (RECOMENDADO)

1. **Abrir Supabase Dashboard**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **SQL Editor**
   - Click en "SQL Editor" en el menú lateral
   - Click en "New query"

3. **Copiar/Pegar**
   - Abre el archivo: `migration_cupones_v2.sql`
   - Copia TODO el contenido
   - Pega en el editor SQL

4. **Ejecutar**
   - Click en "Run" (o Cmd+Enter)
   - Espera confirmación: "Success. No rows returned"

5. **Verificar**
   - Ejecuta estas queries para verificar:

```sql
-- 1. Verificar tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('cupon_notificados', 'cupon_usos', 'notifications');

-- Debe retornar 3 filas

-- 2. Verificar funciones creadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('calcular_gasto_cliente', 'cliente_cumple_condicion_cupon');

-- Debe retornar 2 filas

-- 3. Verificar vista creada
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'v_cupones_stats';

-- Debe retornar 1 fila
```

---

## Opción 2: Línea de Comandos (Avanzado)

Si tienes `psql` instalado y la cadena de conexión:

```bash
# Obtener cadena de conexión de Supabase Dashboard > Project Settings > Database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f migration_cupones_v2.sql
```

---

## ✅ Resultado Esperado

Tras ejecutar la migración, deberías ver:

```
NOTICE:  ✅ Migración completada
NOTICE:  ✅ Tablas creadas: cupon_notificados, cupon_usos, notifications
NOTICE:  ✅ Funciones creadas: calcular_gasto_cliente, cliente_cumple_condicion_cupon
NOTICE:  ✅ Vista creada: v_cupones_stats
NOTICE:  ✅ Políticas RLS aplicadas
```

---

## 🧪 Pruebas Post-Migración

```sql
-- Test 1: Verificar función calcular_gasto_cliente
-- (reemplaza 'user-id' con un ID real de tu tabla profiles)
SELECT calcular_gasto_cliente('00000000-0000-0000-0000-000000000000', 30);
-- Debe retornar un número (puede ser 0)

-- Test 2: Insertar cupón de prueba
INSERT INTO cupones (codigo, descuento_porcentaje, activo, fecha_expiracion)
VALUES ('TEST2025', 10, true, '2025-12-31 23:59:59+00');

-- Test 3: Ver estadísticas
SELECT * FROM v_cupones_stats WHERE codigo = 'TEST2025';
-- Debe mostrar el cupón con 0 notificados y 0 usos

-- Test 4: Limpiar test
DELETE FROM cupones WHERE codigo = 'TEST2025';
```

---

## ⚠️ Solución de Problemas

### Error: "relation already exists"
```sql
-- Si alguna tabla ya existe, ejecuta esto primero:
DROP TABLE IF EXISTS cupon_notificados CASCADE;
DROP TABLE IF EXISTS cupon_usos CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP FUNCTION IF EXISTS calcular_gasto_cliente CASCADE;
DROP FUNCTION IF EXISTS cliente_cumple_condicion_cupon CASCADE;
DROP VIEW IF EXISTS v_cupones_stats CASCADE;

-- Luego ejecuta migration_cupones_v2.sql completo
```

### Error: "permission denied"
- Asegúrate de estar conectado como usuario con permisos de admin
- En Supabase Dashboard, ya tienes los permisos necesarios

### Error: "column already exists"
- Esto es normal si ejecutas la migración múltiples veces
- Los `IF NOT EXISTS` y `IF EXISTS` previenen errores

---

## 📝 Siguiente Paso

Una vez completada la migración, puedes:

1. **Arrancar el servidor**: `npm run dev`
2. **Ir a**: http://localhost:4322/admin/cupones-v2
3. **Crear tu primer cupón** siguiendo las instrucciones en pantalla

---

**Fecha de creación**: Enero 2026  
**Versión**: 2.0

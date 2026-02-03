# 📱 API Móvil - Documentación para Flutter

Esta documentación describe los endpoints REST creados específicamente para la app móvil Flutter de FashionStore.

**Base URL**: `https://tudominio.com/api/mobile`

---

## 🔐 Autenticación

Los endpoints protegidos requieren el header `Authorization`:

```dart
headers: {
  'Authorization': 'Bearer ${supabase.auth.currentSession?.accessToken}',
  'Content-Type': 'application/json',
}
```

---

## 📋 Endpoints Disponibles

### 1. Configuración de la App

```
GET /api/mobile/config
```

**Descripción**: Obtiene la configuración inicial de la app (versión mínima, modo mantenimiento, feature flags, categorías).

**Autenticación**: No requerida

**Respuesta exitosa**:
```json
{
  "success": true,
  "data": {
    "app": {
      "minVersion": "1.0.0",
      "forceUpdate": false,
      "maintenanceMode": false,
      "offersActive": true
    },
    "urls": {
      "termsOfService": "/ayuda#terminos",
      "privacyPolicy": "/ayuda#privacidad",
      "contactEmail": "soporte@fashionstore.com",
      "whatsapp": "+34600000000"
    },
    "features": {
      "pushNotifications": true,
      "inAppChat": true,
      "sizeRecommender": true,
      "guestCheckout": false,
      "applePay": true,
      "googlePay": true
    },
    "categories": [...],
    "apiVersion": "1.0.0"
  }
}
```

---

### 2. Catálogo de Productos

```
GET /api/mobile/catalog
```

**Descripción**: Lista productos con paginación, filtros y ordenación.

**Autenticación**: No requerida

**Parámetros de query**:
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | int | 1 | Número de página |
| `limit` | int | 20 | Productos por página (max 50) |
| `category` | string | - | Slug de categoría |
| `search` | string | - | Término de búsqueda (min 2 chars) |
| `minPrice` | int | - | Precio mínimo (céntimos) |
| `maxPrice` | int | - | Precio máximo (céntimos) |
| `sizes` | string | - | Tallas separadas por coma (ej: "M,L,XL") |
| `sort` | string | newest | Ordenación: `newest`, `price_asc`, `price_desc`, `name` |
| `featured` | bool | false | Solo productos destacados |
| `offers` | bool | false | Solo productos en oferta |

**Ejemplo Flutter**:
```dart
final response = await http.get(Uri.parse(
  '$baseUrl/api/mobile/catalog?page=1&limit=20&category=camisetas&sort=price_asc'
));
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "Camisa Oxford Premium",
        "slug": "camisa-oxford-premium",
        "price": 5990,
        "originalPrice": 7990,
        "discount": 25,
        "images": ["url1", "url2"],
        "category": { "id": "...", "name": "Camisas", "slug": "camisas" },
        "isFeatured": true,
        "isNew": false,
        "variants": [...],
        "availableSizes": ["S", "M", "L"]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 3. Detalle de Producto

```
GET /api/mobile/product/:id
```

**Descripción**: Obtiene información completa de un producto (por ID o slug).

**Autenticación**: No requerida

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Camisa Oxford Premium",
    "description": "Descripción detallada...",
    "price": 5990,
    "originalPrice": 7990,
    "discount": 25,
    "images": ["url1", "url2", "url3"],
    "careInstructions": "Lavar a 30°...",
    "materials": "100% algodón",
    "variants": [
      {
        "id": "variant-uuid",
        "size": "M",
        "color": "Azul",
        "colorHex": "#1E40AF",
        "stock": 5,
        "sku": "COX-M-AZU",
        "inStock": true
      }
    ],
    "availableSizes": ["S", "M", "L"],
    "availableColors": [{ "name": "Azul", "hex": "#1E40AF" }],
    "totalStock": 15,
    "inStock": true,
    "relatedProducts": [...]
  }
}
```

---

### 4. Perfil de Usuario

#### Obtener perfil
```
GET /api/mobile/user/profile
```

**Autenticación**: Requerida

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "user-uuid",
      "email": "usuario@email.com",
      "name": "Juan García",
      "phone": "+34600123456",
      "role": "user",
      "newsletterSubscribed": true,
      "addresses": [...]
    },
    "stats": {
      "totalOrders": 5,
      "totalFavorites": 12
    },
    "availableCoupons": [...]
  }
}
```

#### Actualizar perfil
```
PUT /api/mobile/user/profile
```

**Body**:
```json
{
  "name": "Juan García López",
  "phone": "+34600123456",
  "newsletterSubscribed": true,
  "addresses": [
    {
      "id": "addr-1",
      "name": "Casa",
      "street": "Calle Principal 123",
      "city": "Madrid",
      "postalCode": "28001",
      "isDefault": true
    }
  ]
}
```

---

### 5. Pedidos del Usuario

#### Listar pedidos
```
GET /api/mobile/user/orders
```

**Parámetros**:
- `page`, `limit`: Paginación
- `status`: Filtrar por estado (`pending`, `paid`, `shipped`, `delivered`, `cancelled`)

#### Detalle de pedido
```
GET /api/mobile/user/orders?id=order-uuid
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "orderNumber": "ABC12345",
    "status": "shipped",
    "shippingStatus": "in_transit",
    "amounts": {
      "subtotal": 11980,
      "discount": 1198,
      "shipping": 0,
      "total": 10782
    },
    "items": [...],
    "timeline": [
      { "status": "created", "label": "Pedido creado", "date": "...", "completed": true },
      { "status": "paid", "label": "Pago confirmado", "date": "...", "completed": true },
      { "status": "shipped", "label": "Enviado", "date": "...", "completed": true },
      { "status": "delivered", "label": "Entregado", "date": null, "completed": false }
    ]
  }
}
```

---

### 6. Favoritos

#### Listar favoritos
```
GET /api/mobile/user/favorites
```

#### Añadir favorito
```
POST /api/mobile/user/favorites
Body: { "productId": "product-uuid" }
```

#### Eliminar favorito
```
DELETE /api/mobile/user/favorites
Body: { "productId": "product-uuid" }
```

---

### 7. Cupones

#### Validar cupón
```
POST /api/mobile/coupons/validate
```

**Body**:
```json
{
  "code": "VERANO20",
  "orderTotal": 5990
}
```

**Respuesta exitosa**:
```json
{
  "success": true,
  "valid": true,
  "data": {
    "code": "VERANO20",
    "discountPercentage": 20,
    "discountAmount": 1198,
    "newTotal": 4792,
    "message": "¡Cupón aplicado! 20% de descuento"
  }
}
```

**Respuesta fallida**:
```json
{
  "success": true,
  "valid": false,
  "error": "El cupón ha expirado"
}
```

---

### 8. Checkout - Crear PaymentIntent

```
POST /api/mobile/checkout/create-payment-intent
```

**Autenticación**: Requerida

**Body**:
```json
{
  "userId": "user-uuid",
  "items": [
    { "productId": "prod-1", "variantId": "var-1", "quantity": 2 },
    { "productId": "prod-2", "variantId": "var-3", "quantity": 1 }
  ],
  "couponCode": "VERANO20",
  "shippingAddress": {
    "name": "Juan García",
    "street": "Calle Principal 123, 2ºB",
    "city": "Madrid",
    "postalCode": "28001",
    "province": "Madrid",
    "country": "ES",
    "phone": "+34600123456"
  }
}
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx",
    "orderId": "order-uuid",
    "orderNumber": "ABC12345",
    "summary": {
      "subtotal": 11980,
      "discount": 2396,
      "shipping": 0,
      "total": 9584,
      "itemCount": 3
    },
    "coupon": {
      "code": "VERANO20",
      "discountPercentage": 20,
      "discountAmount": 2396
    }
  }
}
```

---

## 🔧 Uso en Flutter

### Servicio API Base

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

class MobileApiService {
  static const String baseUrl = 'https://tudominio.com/api/mobile';
  
  final SupabaseClient _supabase = Supabase.instance.client;
  
  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_supabase.auth.currentSession != null)
      'Authorization': 'Bearer ${_supabase.auth.currentSession!.accessToken}',
  };
  
  // Obtener catálogo
  Future<CatalogResponse> getCatalog({
    int page = 1,
    int limit = 20,
    String? category,
    String? search,
    String sort = 'newest',
  }) async {
    final params = {
      'page': page.toString(),
      'limit': limit.toString(),
      'sort': sort,
      if (category != null) 'category': category,
      if (search != null) 'search': search,
    };
    
    final uri = Uri.parse('$baseUrl/catalog').replace(queryParameters: params);
    final response = await http.get(uri, headers: _headers);
    
    return CatalogResponse.fromJson(jsonDecode(response.body));
  }
  
  // Crear PaymentIntent
  Future<PaymentIntentResponse> createPaymentIntent({
    required List<CartItem> items,
    required ShippingAddress address,
    String? couponCode,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/checkout/create-payment-intent'),
      headers: _headers,
      body: jsonEncode({
        'userId': _supabase.auth.currentUser!.id,
        'items': items.map((i) => i.toJson()).toList(),
        'shippingAddress': address.toJson(),
        if (couponCode != null) 'couponCode': couponCode,
      }),
    );
    
    return PaymentIntentResponse.fromJson(jsonDecode(response.body));
  }
}
```

---

## ⚠️ Notas Importantes

1. **Precios en céntimos**: Todos los precios están en céntimos (int). Dividir entre 100 para mostrar.

2. **CORS**: Todos los endpoints incluyen headers CORS para permitir peticiones desde la app.

3. **Manejo de errores**: Siempre verificar `success: true/false` en la respuesta.

4. **Paginación**: Usar `hasNextPage` para infinite scroll.

5. **Token refresh**: Supabase Flutter SDK maneja automáticamente el refresh del token.

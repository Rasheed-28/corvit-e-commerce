# Product Catalogue API Contracts & System Architecture

## 1. Architectural & Performance Overview

The Product Catalogue service powers the storefront browsing, filtering, search, and administrative lifecycle for the enterprise e-commerce platform. It is engineered with zero-compromise database efficiency, robust parameter validation, and secure file handling for the React Single Page Application (SPA).

### 1.1 Zero N+1 ORM Query Optimization
Catalogue queries are strictly optimized to execute with minimal database queries regardless of page size or variant count:
- **Product Listings**: Utilizes `select_related('category')` and `prefetch_related('images', 'variants__inventory')`. Primary images, availability status (`is_in_stock`), and total available quantities are computed in-memory across the prefetched cache rather than executing child queries per product.
- **Product Details**: Utilizes `select_related('category', 'category__parent')` and `prefetch_related('images', 'variants__inventory', 'reviews__user')`. Rating averages, stock totals, and variant options are calculated in Python memory.

### 1.2 Dual-Identifier Resolution (Slug or UUID)
Storefront routing and internal administrative systems can reference products seamlessly by either:
1. **Canonical UUID**: E.g., `/api/v1/products/c4f69ad4-6b71-4777-a87a-5b4d70eb1234/`
2. **SEO-Friendly Slug**: E.g., `/api/v1/products/pro-laptop-15/`

Views automatically differentiate between UUID and slug patterns, resolving 404s cleanly if neither exists.

### 1.3 Inventory Availability & Stock Lifecycle
Stock availability is never stored as a raw static boolean. Instead, availability is computed dynamically from variant inventory:
- `available_quantity = max(0, quantity - reserved_quantity)`
- `is_in_stock = available_quantity > 0`
- `is_low_stock = available_quantity <= low_stock_threshold`
- `total_stock = sum(variant.available_quantity for variant in active_variants)`

### 1.4 Strict Query Parameter & Upload Validation
- **Query Parameter Validation**: `DjangoFilterBackend` is configured with `raise_exception = True`. Invalid numeric bounds (e.g., negative prices, `min_price > max_price`) or malformed boolean filters (`in_stock=invalid`) immediately yield standardized HTTP 400 `VALIDATION_ERROR` responses rather than failing silently or causing 500 errors.
- **Image File Integrity**: Uploaded images are checked against a strict 5MB size ceiling, MIME whitelist (`image/jpeg`, `image/png`, `image/webp`), file extension whitelist, and byte-level image integrity verification using Pillow (`PIL.Image.open(file).verify()`). Non-image files disguised as images are rejected with HTTP 400.

### 1.5 Role-Based Access Control (RBAC)
- **Public Customers / Anonymous Users**:
  - Read-only access to published products (`is_active=True`) and active categories.
  - Inactive/unpublished products return HTTP 404.
  - Authenticated customers can submit reviews.
- **Administrative Staff (`is_staff=True`)**:
  - Full CRUD permissions on products, categories, variants, and gallery images.
  - Can inspect unpublished products and filter explicitly by `is_active=true` or `is_active=false`.
  - Can publish/unpublish products via dedicated lifecycle endpoints.
  - Can moderate and approve customer reviews.

---

## 2. Standardized Response Formats

### 2.1 Success Response Envelope
```json
{
  "success": true,
  "message": "Optional descriptive status message",
  "data": { ... },
  "meta": {
    "pagination": {
      "count": 42,
      "page": 1,
      "page_size": 20,
      "total_pages": 3,
      "next": "/api/v1/products/?page=2",
      "previous": null
    }
  }
}
```

### 2.2 Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields failed validation.",
    "details": {
      "min_price": ["Minimum price cannot be greater than maximum price."]
    }
  }
}
```

---

## 3. Product Catalogue Endpoints

### 3.1 List Products
Retrieve paginated products with multi-faceted filtering, full-text search, and sorting.

- **Route**: `GET /api/v1/products/`
- **Permissions**: Public (`AllowAny`). Customers only receive active products.
- **Query Parameters**:
  | Parameter | Type | Description |
  | :--- | :--- | :--- |
  | `search` | String | Full-text search across product title, description, SKU, and variant SKUs |
  | `category` | String | Category slug or UUID. Matches category and its child categories |
  | `min_price` | Decimal | Minimum base price (must be >= 0.00 and <= `max_price`) |
  | `max_price` | Decimal | Maximum base price (must be >= 0.00 and >= `min_price`) |
  | `in_stock` | Boolean | Filter for products with available variant stock (`true` / `false`) |
  | `is_featured`| Boolean | Filter for featured showcase products (`true` / `false`) |
  | `color` | String | Filter products having active variants with the specified color |
  | `size` | String | Filter products having active variants with the specified size |
  | `sku` | String | Exact case-insensitive match on product SKU |
  | `sort` | String | Sorting alias: `price_asc`, `price_desc`, `newest`, `oldest`, `title_asc`, `title_desc` |
  | `page` | Integer | Page index (default: 1) |
  | `page_size` | Integer | Number of items per page (default: 20, max: 100) |
  | `is_active` | Boolean | Staff only: filter active/inactive items |

- **Sample Request**:
  `GET /api/v1/products/?category=electronics&min_price=100&max_price=1500&in_stock=true&sort=price_asc`

- **Sample Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "b3e34b1a-9669-429a-b42e-cfd0ff10a801",
      "title": "Pro Laptop 15",
      "slug": "pro-laptop-15",
      "sku": "LAP-15-PRO",
      "base_price": "1299.99",
      "category": "a1c12b9a-4122-4a0b-99d9-482ba63f2345",
      "category_name": "Laptops",
      "category_slug": "laptops",
      "primary_image": "http://127.0.0.1:8000/media/products/laptop.jpg",
      "is_in_stock": true,
      "available_quantity": 25,
      "is_active": true,
      "is_featured": true,
      "created_at": "2026-10-17T14:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "count": 1,
      "page": 1,
      "page_size": 20,
      "total_pages": 1,
      "next": null,
      "previous": null
    }
  }
}
```

---

### 3.2 Product Details
Retrieve full product details including image gallery, variant specifications, stock availability, and verified customer reviews.

- **Route**: `GET /api/v1/products/<slug_or_id>/`
- **Permissions**: Public (`AllowAny`). Unpublished products return 404 to regular users.

- **Sample Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "b3e34b1a-9669-429a-b42e-cfd0ff10a801",
    "title": "Pro Laptop 15",
    "slug": "pro-laptop-15",
    "sku": "LAP-15-PRO",
    "description": "High performance developer laptop with aluminum chassis.",
    "base_price": "1299.99",
    "category": {
      "id": "a1c12b9a-4122-4a0b-99d9-482ba63f2345",
      "name": "Laptops",
      "slug": "laptops",
      "parent_name": "Computers",
      "children": []
    },
    "images": [
      {
        "id": "e2c34a11-5421-4b11-9a22-2144ba992301",
        "image": "http://127.0.0.1:8000/media/products/laptop_front.jpg",
        "alt_text": "Front view",
        "is_primary": true,
        "display_order": 0
      }
    ],
    "variants": [
      {
        "id": "d1e44a22-7711-4c33-88bb-1234ba559901",
        "name": "16GB RAM / 512GB SSD",
        "sku": "LAP-15-16-512",
        "color": "Space Gray",
        "size": "15-inch",
        "price_override": null,
        "effective_price": "1299.99",
        "quantity": 15,
        "available_quantity": 15,
        "is_in_stock": true,
        "is_low_stock": false,
        "attributes": {
          "ram": "16GB",
          "storage": "512GB"
        },
        "is_active": true
      }
    ],
    "total_stock": 15,
    "is_in_stock": true,
    "rating_summary": {
      "average_rating": 4.8,
      "review_count": 12
    },
    "reviews": [
      {
        "id": "f5e66a33-1122-4a44-99cc-6543ba118801",
        "user": {
          "id": "a9b8c7d6-e5f4-3210-9876-543210abcdef",
          "username": "jane_doe",
          "full_name": "Jane Doe"
        },
        "rating": 5,
        "title": "Excellent build quality",
        "comment": "Blazing fast compilation times and superb battery life.",
        "is_verified_purchase": true,
        "created_at": "2026-10-17T15:00:00Z"
      }
    ],
    "is_active": true,
    "is_featured": true,
    "created_at": "2026-10-17T14:00:00Z",
    "updated_at": "2026-10-17T14:30:00Z"
  }
}
```

---

### 3.3 Create Product (Staff Only)
Creates a new product with optional initial variants and inventory atomically.

- **Route**: `POST /api/v1/products/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)
- **Headers**: `X-CSRFToken: <token>`, `Content-Type: application/json`

- **Sample Request Payload**:
```json
{
  "title": "UltraSharp 27 Monitor",
  "sku": "MON-27-4K",
  "description": "High resolution professional monitor with HDR support.",
  "base_price": "450.00",
  "category": "a1c12b9a-4122-4a0b-99d9-482ba63f2345",
  "is_featured": true,
  "variants": [
    {
      "name": "Standard Stand",
      "sku": "MON-27-STD",
      "quantity": 20,
      "low_stock_threshold": 5
    },
    {
      "name": "Ergonomic Arm",
      "sku": "MON-27-ARM",
      "price_override": "499.99",
      "quantity": 10,
      "low_stock_threshold": 3
    }
  ]
}
```

- **Response (201 Created)**: Returns the newly created product in full detail structure.

---

### 3.4 Update Product (Staff Only)
- **Route**: `PATCH /api/v1/products/<slug_or_id>/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)

- **Sample Request**:
```json
{
  "base_price": "429.99",
  "is_featured": false
}
```

---

### 3.5 Delete Product (Staff Only)
- **Route**: `DELETE /api/v1/products/<slug_or_id>/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)

- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Product deleted successfully."
}
```

---

### 3.6 Publish & Unpublish Endpoints (Staff Only)
Dedicated lifecycle management endpoints to transition publication status.

- **Publish**: `POST /api/v1/products/<slug_or_id>/publish/`
- **Unpublish**: `POST /api/v1/products/<slug_or_id>/unpublish/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)

---

## 4. Product Variants & Inventory Endpoints

### 4.1 List or Create Variants
- **Route**: `GET /api/v1/products/<slug_or_id>/variants/` (Public)
- **Route**: `POST /api/v1/products/<slug_or_id>/variants/` (Staff Only)

- **Create Variant Payload**:
```json
{
  "name": "64GB RAM / 2TB SSD Edition",
  "sku": "LAP-15-64-2TB",
  "price_override": "2199.99",
  "color": "Titanium",
  "size": "15-inch",
  "quantity": 8,
  "low_stock_threshold": 2,
  "attributes": {
    "ram": "64GB",
    "ssd": "2TB"
  }
}
```

### 4.2 Update Variant Stock & Attributes (Staff Only)
- **Route**: `PATCH /api/v1/variants/<id>/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)

- **Update Variant Payload**:
```json
{
  "quantity": 25,
  "low_stock_threshold": 5
}
```

### 4.3 Delete Variant (Staff Only)
- **Route**: `DELETE /api/v1/variants/<id>/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)

---

## 5. Product Image Gallery Endpoints

### 5.1 Upload Image (Staff Only)
Validates image size (<= 5MB), format (JPEG, PNG, WebP), and byte integrity via Pillow.

- **Route**: `POST /api/v1/products/<slug_or_id>/images/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)
- **Headers**: `Content-Type: multipart/form-data`, `X-CSRFToken: <token>`
- **Form Data**:
  - `image`: File (Binary image)
  - `alt_text`: String (e.g. `"Front view with keyboard illuminated"`)
  - `is_primary`: Boolean (`true` / `false`)

### 5.2 Delete Image (Staff Only)
- **Route**: `DELETE /api/v1/images/<id>/`
- **Permissions**: `IsAdminUser` (`is_staff=True`)

---

## 6. Category Endpoints

### 6.1 List Categories
- **Route**: `GET /api/v1/categories/`
- **Permissions**: Public (`AllowAny`)
- **Query Parameters**:
  - `flat`: Boolean (`true` returns flat list; default `false` returns recursive hierarchical tree)

- **Sample Hierarchical Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "e1f2a3b4-1122-3344-5566-778899aabbcc",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Consumer electronics and computing devices",
      "parent": null,
      "children": [
        {
          "id": "a1c12b9a-4122-4a0b-99d9-482ba63f2345",
          "name": "Laptops",
          "slug": "laptops"
        }
      ]
    }
  ]
}
```

### 6.2 Category Management (Staff Only)
- `POST /api/v1/categories/`: Create category (`name`, `description`, `parent`, `image`)
- `PATCH /api/v1/categories/<slug_or_id>/`: Update category
- `DELETE /api/v1/categories/<slug_or_id>/`: Delete category

---

## 7. React Frontend Service (`catalogApi.js`)

The React frontend integrates with the catalog using `frontend/src/api/catalogApi.js`:

```javascript
import { catalogApi } from '../api/catalogApi';

// 1. Fetch filtered and sorted products
const response = await catalogApi.getProducts({
  category: 'electronics',
  min_price: 50.00,
  max_price: 1500.00,
  in_stock: true,
  sort: 'price_asc',
  page: 1,
});
console.log('Products:', response.data);
console.log('Total count:', response.meta.pagination.count);

// 2. Fetch product detail by slug
const detailResponse = await catalogApi.getProduct('pro-laptop-15');
console.log('Product Details:', detailResponse.data);

// 3. Upload gallery image (Staff)
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('alt_text', 'Side angle');
formData.append('is_primary', false);
await catalogApi.uploadProductImage('pro-laptop-15', formData);
```

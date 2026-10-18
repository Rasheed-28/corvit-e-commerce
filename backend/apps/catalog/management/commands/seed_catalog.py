from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.accounts.models import CustomerProfile, Address
from apps.catalog.models import (
    ProductCategory,
    Product,
    ProductVariant,
    Inventory,
    ProductImage,
    Review,
)

User = get_user_model()

class Command(BaseCommand):
    help = "Seeds initial database with categories, products, inventory, users, and reviews."

    def handle(self, *args, **options):
        self.stdout.write("Starting database seed...")

        # 1. Create Demo Customer User
        alex, created = User.objects.get_or_create(
            username="alex.reynolds@example.com",
            defaults={
                "email": "alex.reynolds@example.com",
                "first_name": "Alex",
                "last_name": "Reynolds",
                "is_active": True,
            },
        )
        alex.set_password("NovaStore2026!")
        alex.save()

        profile, _ = CustomerProfile.objects.get_or_create(
            user=alex,
            defaults={
                "phone_number": "+1 (555) 234-5678",
                "is_newsletter_subscribed": True,
            },
        )

        address, _ = Address.objects.get_or_create(
            user=alex,
            street_address_1="100 Market Street, Suite 400",
            defaults={
                "address_type": "home",
                "full_name": "Alex Reynolds",
                "phone_number": "+1 (555) 234-5678",
                "city": "San Francisco",
                "state_or_province": "CA",
                "postal_code": "94105",
                "country": "US",
                "is_default": True,
            },
        )

        # 2. Create Admin / Staff User
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@novastore.example.com",
                "first_name": "NovaStore",
                "last_name": "Administrator",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        admin_user.set_password("AdminPass2026!")
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()

        # 3. Create Additional Reviewer Users
        marcus, _ = User.objects.get_or_create(
            username="marcus.vance@example.com",
            defaults={
                "email": "marcus.vance@example.com",
                "first_name": "Marcus",
                "last_name": "Vance",
                "is_active": True,
            },
        )
        marcus.set_password("NovaStore2026!")
        marcus.save()

        sophia, _ = User.objects.get_or_create(
            username="sophia.lin@example.com",
            defaults={
                "email": "sophia.lin@example.com",
                "first_name": "Sophia",
                "last_name": "Lin",
                "is_active": True,
            },
        )
        sophia.set_password("NovaStore2026!")
        sophia.save()

        # 4. Categories
        categories_data = [
            {
                "name": "Audio & Acoustics",
                "slug": "audio",
                "description": "Precision studio monitors, noise-canceling headphones, and wireless earbuds.",
            },
            {
                "name": "Smart Wearables",
                "slug": "wearables",
                "description": "Sapphire glass smartwatches, wellness trackers, and connected timepieces.",
            },
            {
                "name": "Lifestyle & Everyday",
                "slug": "lifestyle",
                "description": "Minimalist leather goods, modular carry backpacks, and polarized eyewear.",
            },
            {
                "name": "Workspace Design",
                "slug": "workspace",
                "description": "Ergonomic mechanical keyboards, desk mats, and solid walnut accessories.",
            },
        ]

        cats_by_slug = {}
        for cdata in categories_data:
            cat, _ = ProductCategory.objects.update_or_create(
                slug=cdata["slug"],
                defaults={
                    "name": cdata["name"],
                    "description": cdata["description"],
                    "is_active": True,
                },
            )
            cats_by_slug[cdata["slug"]] = cat

        # 5. Products Data
        products_data = [
            {
                "slug": "aura-studio-wireless-headphones",
                "title": "Aura Studio Wireless Over-Ear Headphones",
                "category_slug": "audio",
                "base_price": Decimal("249.00"),
                "sku": "AUR-WL-01",
                "is_featured": True,
                "description": "Engineered with 40mm custom planar drivers, active hybrid noise cancellation, and aerospace-grade aluminum chassis for pure acoustic fidelity.",
                "variants": [
                    {"name": "Matte Black", "sku": "AUR-WL-01-BLK", "color": "Matte Black", "quantity": 14},
                    {"name": "Silver Mist", "sku": "AUR-WL-01-SLV", "color": "Silver Mist", "quantity": 8},
                    {"name": "Forest Green", "sku": "AUR-WL-01-GRN", "color": "Forest Green", "quantity": 5},
                ],
                "reviews": [
                    {"user": marcus, "rating": 5, "title": "Incredible sound", "comment": "Exceptional build quality and audio fidelity. Easily the best purchase I made this quarter."},
                    {"user": sophia, "rating": 4, "title": "Great ANC", "comment": "Super sleek design, battery life exceeded my expectations. Shipping was within 2 days."},
                ],
            },
            {
                "slug": "chronos-vanguard-titanium-smartwatch",
                "title": "Chronos Vanguard Titanium Smartwatch",
                "category_slug": "wearables",
                "base_price": Decimal("389.00"),
                "sku": "CHR-TI-02",
                "is_featured": True,
                "description": "Forged Grade-5 titanium bezel with sapphire crystal touch display, continuous ECG bio-tracking, and 100m water resistance.",
                "variants": [
                    {"name": "Brushed Titanium", "sku": "CHR-TI-02-TI", "color": "Brushed Titanium", "quantity": 6},
                    {"name": "DLC Midnight", "sku": "CHR-TI-02-BLK", "color": "DLC Midnight", "quantity": 4},
                ],
                "reviews": [
                    {"user": alex, "rating": 5, "title": "Premium watch", "comment": "Grade-5 titanium feels fantastic on the wrist. Outstanding battery life."},
                ],
            },
            {
                "slug": "apex-commuter-waterproof-backpack",
                "title": "Apex Modular Commuter Backpack 24L",
                "category_slug": "lifestyle",
                "base_price": Decimal("159.00"),
                "sku": "APX-BP-24",
                "is_featured": True,
                "description": "Weatherproof recycled Cordura exterior featuring magnetic Fidlock buckles, dedicated 16-inch suspended laptop vault, and luggage pass-through.",
                "variants": [
                    {"name": "Obsidian Black", "sku": "APX-BP-24-BLK", "color": "Obsidian Black", "quantity": 19},
                    {"name": "Slate Gray", "sku": "APX-BP-24-GRY", "color": "Slate Gray", "quantity": 10},
                    {"name": "Olive Drab", "sku": "APX-BP-24-OLV", "color": "Olive Drab", "quantity": 7},
                ],
                "reviews": [
                    {"user": marcus, "rating": 5, "title": "Best commuter pack", "comment": "Holds everything securely and comfortably. Fidlock magnetic buckles are very intuitive."},
                ],
            },
            {
                "slug": "keychron-lumina-mechanical-keyboard",
                "title": "Lumina Q3 Wireless Mechanical Keyboard",
                "category_slug": "workspace",
                "base_price": Decimal("179.00"),
                "sku": "LUM-KB-75",
                "is_featured": True,
                "description": "CNC anodized aluminum body with hot-swappable gasket-mounted tactile switches, south-facing RGB backlighting, and Mac/Windows switch.",
                "variants": [
                    {"name": "Carbon Black", "sku": "LUM-KB-75-BLK", "color": "Carbon Black", "quantity": 3},
                    {"name": "Retro Silver", "sku": "LUM-KB-75-SLV", "color": "Retro Silver", "quantity": 2},
                ],
                "reviews": [
                    {"user": alex, "rating": 5, "title": "Typing heaven", "comment": "The gasket mount feels incredible. Solid aluminum chassis with zero ping."},
                ],
            },
            {
                "slug": "solis-polarized-titanium-sunglasses",
                "title": "Solis Polarized Japanese Titanium Eyewear",
                "category_slug": "lifestyle",
                "base_price": Decimal("195.00"),
                "sku": "SOL-SUN-05",
                "is_featured": False,
                "description": "Ultralight 18-gram Japanese beta-titanium wireframe with anti-reflective polarized crystal lenses providing 100% UVA/UVB optical clarity.",
                "variants": [
                    {"name": "Brushed Gold", "sku": "SOL-SUN-05-GLD", "color": "Brushed Gold", "quantity": 22},
                    {"name": "Matte Gunmetal", "sku": "SOL-SUN-05-GUN", "color": "Matte Gunmetal", "quantity": 15},
                ],
                "reviews": [
                    {"user": sophia, "rating": 5, "title": "Featherlight", "comment": "Weighs nothing and the polarized lenses offer remarkable clarity."},
                ],
            },
            {
                "slug": "pulse-true-wireless-anc-earbuds",
                "title": "Pulse Pro Wireless Earbuds with Spatial Audio",
                "category_slug": "audio",
                "base_price": Decimal("149.00"),
                "sku": "PLS-EP-06",
                "is_featured": True,
                "description": "Ultra-compact wireless in-ear monitors with adaptive transparency mode, 6-mic beamforming array for crystal-clear calls, and Qi wireless charging.",
                "variants": [
                    {"name": "Glacier White", "sku": "PLS-EP-06-WHT", "color": "Glacier White", "quantity": 35},
                    {"name": "Phantom Black", "sku": "PLS-EP-06-BLK", "color": "Phantom Black", "quantity": 20},
                ],
                "reviews": [
                    {"user": marcus, "rating": 5, "title": "Amazing transparency mode", "comment": "Super comfortable for long listening sessions. Mic quality is top-notch."},
                ],
            },
            {
                "slug": "walnut-artisan-desk-shelf-riser",
                "title": "Solid American Walnut Dual-Monitor Desk Shelf",
                "category_slug": "workspace",
                "base_price": Decimal("135.00"),
                "sku": "WNT-DS-07",
                "is_featured": False,
                "description": "Handcrafted from sustainable Appalachian solid walnut with powder-coated aluminum legs, cork footpads, and integrated cable routing channel.",
                "variants": [
                    {"name": "Natural Walnut", "sku": "WNT-DS-07-WAL", "color": "Natural Walnut", "quantity": 0},
                ],
                "reviews": [
                    {"user": alex, "rating": 5, "title": "Handcrafted perfection", "comment": "Elevates the entire aesthetic of my home office setup."},
                ],
            },
            {
                "slug": "aeropress-precision-thermal-flask",
                "title": "Nordic Double-Wall Vacuum Thermal Tumbler",
                "category_slug": "lifestyle",
                "base_price": Decimal("42.00"),
                "sku": "NDC-TH-08",
                "is_featured": True,
                "description": "Medical-grade 18/8 stainless steel thermal vessel with leakproof twist-lock 360-degree lid. Keeps beverages piping hot for 12 hours or iced for 24.",
                "variants": [
                    {"name": "Sage Green", "sku": "NDC-TH-08-GRN", "color": "Sage Green", "quantity": 45},
                    {"name": "Stone Grey", "sku": "NDC-TH-08-GRY", "color": "Stone Grey", "quantity": 30},
                    {"name": "Matte Cream", "sku": "NDC-TH-08-CRM", "color": "Matte Cream", "quantity": 25},
                ],
                "reviews": [
                    {"user": sophia, "rating": 5, "title": "Keeps coffee hot all day", "comment": "Never leaks in my bag, cleans easily, beautiful matte powder coat."},
                ],
            },
        ]

        sample_image_rel = "products/2026/10/laptop_front.png"

        for pdata in products_data:
            cat = cats_by_slug.get(pdata["category_slug"])
            product, _ = Product.objects.update_or_create(
                slug=pdata["slug"],
                defaults={
                    "title": pdata["title"],
                    "category": cat,
                    "base_price": pdata["base_price"],
                    "sku": pdata["sku"],
                    "is_active": True,
                    "is_featured": pdata["is_featured"],
                    "description": pdata["description"],
                },
            )

            # Product Image
            ProductImage.objects.get_or_create(
                product=product,
                image=sample_image_rel,
                defaults={
                    "alt_text": product.title,
                    "is_primary": True,
                    "display_order": 0,
                },
            )

            # Variants & Inventory
            for vdata in pdata["variants"]:
                variant, _ = ProductVariant.objects.update_or_create(
                    product=product,
                    sku=vdata["sku"],
                    defaults={
                        "name": vdata["name"],
                        "color": vdata.get("color", ""),
                        "size": vdata.get("size", ""),
                        "is_active": True,
                    },
                )
                inventory, _ = Inventory.objects.get_or_create(
                    variant=variant,
                    defaults={
                        "quantity": vdata["quantity"],
                        "low_stock_threshold": 5,
                    },
                )
                inventory.quantity = vdata["quantity"]
                inventory.save()

            # Reviews
            for rdata in pdata.get("reviews", []):
                Review.objects.update_or_create(
                    product=product,
                    user=rdata["user"],
                    defaults={
                        "rating": rdata["rating"],
                        "title": rdata["title"],
                        "comment": rdata["comment"],
                        "is_verified_purchase": True,
                        "is_approved": True,
                    },
                )

        self.stdout.write(self.style.SUCCESS("Database seeded successfully with users, categories, products, inventory, and reviews."))

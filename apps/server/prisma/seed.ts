import {
  PrismaClient,
  UserRole,
  BusinessType,
  BusinessStatus,
  SubscriptionStatus,
  TableStatus,
  OfferType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  NotificationType,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.info('🌱 Starting database seed for Neon Postgres...');

  // OWASP: bcrypt cost factor ≥ 12
  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Seed Diverse Businesses (Restaurant, Club, Lounge, Café)
  const alchemist = await prisma.business.upsert({
    where: { slug: 'alchemist-westlands' },
    update: {},
    create: {
      businessUuid: '11111111-1111-1111-1111-111111111111',
      name: 'The Alchemist Westlands',
      slug: 'alchemist-westlands',
      businessType: BusinessType.LOUNGE,
      logoUrl: 'https://orderup.co.ke/logos/alchemist.png',
      phone: '+254712345678',
      email: 'info@alchemist.co.ke',
      city: 'Nairobi',
      county: 'Nairobi',
      address: 'Parklands Road, Westlands',
      themeColor: '#e11d48',
      openingHours: '14:00',
      closingHours: '04:00',
      status: BusinessStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive: true,
    },
  });

  const bclub = await prisma.business.upsert({
    where: { slug: 'bclub-kilimani' },
    update: {},
    create: {
      businessUuid: '22222222-2222-2222-2222-222222222222',
      name: 'B-Club Kilimani',
      slug: 'bclub-kilimani',
      businessType: BusinessType.CLUB,
      logoUrl: 'https://orderup.co.ke/logos/bclub.png',
      phone: '+254722998877',
      email: 'vip@bclub.co.ke',
      city: 'Nairobi',
      county: 'Nairobi',
      address: 'Galana Plaza, Kilimani',
      themeColor: '#7c3aed',
      openingHours: '18:00',
      closingHours: '05:00',
      status: BusinessStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive: true,
    },
  });

  const gplace = await prisma.business.upsert({
    where: { slug: 'g-place' },
    update: {},
    create: {
      businessUuid: '33333333-3333-3333-3333-333333333333',
      name: 'G Place Restaurant & Lounge',
      slug: 'g-place',
      businessType: BusinessType.RESTAURANT,
      logoUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=400&auto=format&fit=crop&q=80',
      phone: '+254722334455',
      email: 'info@gplace.co.ke',
      city: 'Nairobi',
      county: 'Nairobi',
      address: 'Kiambu Road, Nairobi',
      themeColor: '#2563EB',
      openingHours: '08:00',
      closingHours: '23:00',
      status: BusinessStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      isActive: true,
    },
  });

  console.info('✅ Businesses seeded');

  // 2. Seed Users across the Role Hierarchy
  // Super Admin (businessUuid: NULL)
  await prisma.user.upsert({
    where: { email: 'superadmin@orderup.co.ke' },
    update: { passwordHash, role: UserRole.SUPER_ADMIN },
    create: {
      userUuid: '00000000-0000-0000-0000-000000000001',
      email: 'superadmin@orderup.co.ke',
      passwordHash,
      fullName: 'Super Administrator',
      phone: '+254700000000',
      role: UserRole.SUPER_ADMIN,
    },
  });

  // Business Admin (Owner) for Alchemist
  await prisma.user.upsert({
    where: { email: 'admin@alchemist.co.ke' },
    update: { passwordHash, role: UserRole.ADMIN, businessUuid: alchemist.businessUuid },
    create: {
      userUuid: '11111111-1111-1111-1111-000000000001',
      businessUuid: alchemist.businessUuid,
      email: 'admin@alchemist.co.ke',
      passwordHash,
      fullName: 'John Alchemist Admin',
      phone: '+254711111111',
      role: UserRole.ADMIN,
    },
  });

  // Manager for Alchemist
  await prisma.user.upsert({
    where: { email: 'manager@alchemist.co.ke' },
    update: { passwordHash, role: UserRole.MANAGER, businessUuid: alchemist.businessUuid },
    create: {
      userUuid: '11111111-1111-1111-1111-000000000003',
      businessUuid: alchemist.businessUuid,
      email: 'manager@alchemist.co.ke',
      passwordHash,
      fullName: 'David Alchemist Manager',
      phone: '+254711999999',
      role: UserRole.MANAGER,
    },
  });

  // Waiter for Alchemist
  await prisma.user.upsert({
    where: { email: 'waiter.kamau@alchemist.co.ke' },
    update: { passwordHash, role: UserRole.WAITER, businessUuid: alchemist.businessUuid },
    create: {
      userUuid: '11111111-1111-1111-1111-000000000002',
      businessUuid: alchemist.businessUuid,
      email: 'waiter.kamau@alchemist.co.ke',
      passwordHash,
      fullName: 'Kamau Njoroge',
      phone: '+254711223344',
      role: UserRole.WAITER,
    },
  });

  // Business Admin for B-Club
  await prisma.user.upsert({
    where: { email: 'admin@bclub.co.ke' },
    update: { passwordHash, role: UserRole.ADMIN, businessUuid: bclub.businessUuid },
    create: {
      userUuid: '22222222-2222-2222-2222-000000000001',
      businessUuid: bclub.businessUuid,
      email: 'admin@bclub.co.ke',
      passwordHash,
      fullName: 'Sarah B-Club Admin',
      phone: '+254722000111',
      role: UserRole.ADMIN,
    },
  });

  // Business Admin for G-Place
  await prisma.user.upsert({
    where: { email: 'belvin.rotich@gplace.co.ke' },
    update: { passwordHash, businessUuid: gplace.businessUuid, fullName: 'Belvin Rotich', role: UserRole.ADMIN, isActive: true },
    create: {
      userUuid: '33333333-3333-3333-3333-000000000001',
      businessUuid: gplace.businessUuid,
      email: 'belvin.rotich@gplace.co.ke',
      passwordHash,
      fullName: 'Belvin Rotich',
      phone: '+254722334455',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'belvin@gplace.co.ke' },
    update: { passwordHash, businessUuid: gplace.businessUuid, fullName: 'Belvin Rotich', role: UserRole.ADMIN, isActive: true },
    create: {
      userUuid: '33333333-3333-3333-3333-000000000002',
      businessUuid: gplace.businessUuid,
      email: 'belvin@gplace.co.ke',
      passwordHash,
      fullName: 'Belvin Rotich',
      phone: '+254722334455',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // Demo Credentials for Staff Portal
  const adminHash = await bcrypt.hash('Lionel123', 12);
  const managerHash = await bcrypt.hash('Langat123', 12);
  const waiterHash = await bcrypt.hash('Jane1234', 12);

  await prisma.user.upsert({
    where: { email: 'langatlionel@gmail.com' },
    update: { passwordHash: adminHash, role: UserRole.ADMIN, businessUuid: alchemist.businessUuid, isActive: true },
    create: {
      userUuid: '11111111-1111-1111-1111-000000000009',
      businessUuid: alchemist.businessUuid,
      email: 'langatlionel@gmail.com',
      passwordHash: adminHash,
      fullName: 'Lionel Langat (Admin)',
      phone: '+254711000111',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'lionellangat2000@gmail.com' },
    update: { passwordHash: managerHash, role: UserRole.MANAGER, businessUuid: alchemist.businessUuid, isActive: true },
    create: {
      userUuid: '11111111-1111-1111-1111-000000000010',
      businessUuid: alchemist.businessUuid,
      email: 'lionellangat2000@gmail.com',
      passwordHash: managerHash,
      fullName: 'Lionel Langat (Manager)',
      phone: '+254711000222',
      role: UserRole.MANAGER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'llangat325@gmail.com' },
    update: { passwordHash: waiterHash, role: UserRole.WAITER, businessUuid: alchemist.businessUuid, isActive: true },
    create: {
      userUuid: '11111111-1111-1111-1111-000000000011',
      businessUuid: alchemist.businessUuid,
      email: 'llangat325@gmail.com',
      passwordHash: waiterHash,
      fullName: 'Lionel Langat (Waiter)',
      phone: '+254711000333',
      role: UserRole.WAITER,
      isActive: true,
    },
  });

  console.info('✅ Users seeded');

  // 3. Seed Venue Tables
  await prisma.venueTable.upsert({
    where: { businessUuid_tableNumber: { businessUuid: alchemist.businessUuid, tableNumber: 1 } },
    update: {},
    create: {
      tableUuid: '11111111-4444-1111-1111-000000000001',
      businessUuid: alchemist.businessUuid,
      tableNumber: 1,
      sectionName: 'Main Courtyard',
      seatingCapacity: 4,
      status: TableStatus.AVAILABLE,
    },
  });

  await prisma.venueTable.upsert({
    where: { businessUuid_tableNumber: { businessUuid: alchemist.businessUuid, tableNumber: 2 } },
    update: {},
    create: {
      tableUuid: '11111111-4444-1111-1111-000000000002',
      businessUuid: alchemist.businessUuid,
      tableNumber: 2,
      sectionName: 'Main Courtyard',
      seatingCapacity: 6,
      status: TableStatus.OCCUPIED,
    },
  });

  await prisma.venueTable.upsert({
    where: { businessUuid_tableNumber: { businessUuid: alchemist.businessUuid, tableNumber: 10 } },
    update: {},
    create: {
      tableUuid: '11111111-4444-1111-1111-000000000003',
      businessUuid: alchemist.businessUuid,
      tableNumber: 10,
      sectionName: 'VIP Lounge',
      seatingCapacity: 8,
      status: TableStatus.RESERVED,
    },
  });

  console.info('✅ Tables seeded');

  // 4. Seed Menu Categories
  const beersCat = await prisma.menuCategory.upsert({
    where: { businessUuid_name: { businessUuid: alchemist.businessUuid, name: 'Local & Craft Beers' } },
    update: {},
    create: {
      categoryUuid: '11111111-3333-1111-1111-000000000001',
      businessUuid: alchemist.businessUuid,
      name: 'Local & Craft Beers',
      description: 'Cold Kenyan lager and craft beers',
      displayOrder: 1,
    },
  });

  const cocktailsCat = await prisma.menuCategory.upsert({
    where: { businessUuid_name: { businessUuid: alchemist.businessUuid, name: 'Cocktails & Mixers' } },
    update: {},
    create: {
      categoryUuid: '11111111-3333-1111-1111-000000000002',
      businessUuid: alchemist.businessUuid,
      name: 'Cocktails & Mixers',
      description: 'Signature African infused cocktails',
      displayOrder: 2,
    },
  });

  const foodCat = await prisma.menuCategory.upsert({
    where: { businessUuid_name: { businessUuid: alchemist.businessUuid, name: 'Bitings & Grill' } },
    update: {},
    create: {
      categoryUuid: '11111111-3333-1111-1111-000000000003',
      businessUuid: alchemist.businessUuid,
      name: 'Bitings & Grill',
      description: 'Nyama Choma and bar snacks',
      displayOrder: 3,
    },
  });

  console.info('✅ Menu categories seeded');

  // 5. Seed Products
  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: alchemist.businessUuid, sku: 'TUSK-500' } },
    update: {},
    create: {
      productUuid: '11111111-5555-1111-1111-000000000001',
      businessUuid: alchemist.businessUuid,
      categoryUuid: beersCat.categoryUuid,
      name: 'Tusker Lager (500ml)',
      description: 'Kenya finest ice cold lager',
      price: 350.00,
      sku: 'TUSK-500',
      isAvailable: true,
    },
  });

  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: alchemist.businessUuid, sku: 'WCAP-500' } },
    update: {},
    create: {
      productUuid: '11111111-5555-1111-1111-000000000002',
      businessUuid: alchemist.businessUuid,
      categoryUuid: beersCat.categoryUuid,
      name: 'White Cap Crisp (500ml)',
      description: 'Sugar-free crisp lager',
      price: 380.00,
      sku: 'WCAP-500',
      isAvailable: true,
    },
  });

  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: alchemist.businessUuid, sku: 'DAWA-01' } },
    update: {},
    create: {
      productUuid: '11111111-5555-1111-1111-000000000003',
      businessUuid: alchemist.businessUuid,
      categoryUuid: cocktailsCat.categoryUuid,
      name: 'Nairobi Dawa Cocktail',
      description: 'Vodka, honey, lime & ginger stem',
      price: 750.00,
      sku: 'DAWA-01',
      isAvailable: true,
    },
  });

  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: alchemist.businessUuid, sku: 'CHOMA-1KG' } },
    update: {},
    create: {
      productUuid: '11111111-5555-1111-1111-000000000004',
      businessUuid: alchemist.businessUuid,
      categoryUuid: foodCat.categoryUuid,
      name: 'Nyama Choma Platter (1kg)',
      description: 'Grilled goat meat served with Kachumbari',
      price: 1800.00,
      sku: 'CHOMA-1KG',
      isAvailable: true,
    },
  });

  // G-Place Venue Tables
  await prisma.venueTable.upsert({
    where: { businessUuid_tableNumber: { businessUuid: gplace.businessUuid, tableNumber: 1 } },
    update: {},
    create: {
      tableUuid: '33333333-4444-1111-1111-000000000001',
      businessUuid: gplace.businessUuid,
      tableNumber: 1,
      sectionName: 'Main Lounge',
      seatingCapacity: 4,
      status: TableStatus.AVAILABLE,
    },
  });

  await prisma.venueTable.upsert({
    where: { businessUuid_tableNumber: { businessUuid: gplace.businessUuid, tableNumber: 2 } },
    update: {},
    create: {
      tableUuid: '33333333-4444-1111-1111-000000000002',
      businessUuid: gplace.businessUuid,
      tableNumber: 2,
      sectionName: 'VIP Section',
      seatingCapacity: 6,
      status: TableStatus.AVAILABLE,
    },
  });

  // G-Place Menu Categories
  const gplaceBeers = await prisma.menuCategory.upsert({
    where: { businessUuid_name: { businessUuid: gplace.businessUuid, name: 'Whiskey & Spirits' } },
    update: {},
    create: {
      categoryUuid: '33333333-3333-1111-1111-000000000001',
      businessUuid: gplace.businessUuid,
      name: 'Whiskey & Spirits',
      description: 'Premium whiskeys and spirits',
      displayOrder: 1,
    },
  });

  const gplaceBeersCat = await prisma.menuCategory.upsert({
    where: { businessUuid_name: { businessUuid: gplace.businessUuid, name: 'Cold Beers & Ciders' } },
    update: {},
    create: {
      categoryUuid: '33333333-3333-1111-1111-000000000002',
      businessUuid: gplace.businessUuid,
      name: 'Cold Beers & Ciders',
      description: 'Ice cold lagers and ciders',
      displayOrder: 2,
    },
  });

  // G-Place Products (Jack Daniels, Johnnie Walker Black, Tusker)
  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: gplace.businessUuid, sku: 'JD-750' } },
    update: {},
    create: {
      productUuid: '33333333-5555-1111-1111-000000000001',
      businessUuid: gplace.businessUuid,
      categoryUuid: gplaceBeers.categoryUuid,
      name: "Jack Daniel's Old No. 7 (750ml)",
      description: 'Tennessee sour mash whiskey',
      price: 4500.00,
      sku: 'JD-750',
      imageUrl: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
    },
  });

  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: gplace.businessUuid, sku: 'JW-BLACK-750' } },
    update: {},
    create: {
      productUuid: '33333333-5555-1111-1111-000000000002',
      businessUuid: gplace.businessUuid,
      categoryUuid: gplaceBeers.categoryUuid,
      name: 'Johnnie Walker Black Label (750ml)',
      description: 'Iconic 12 year blended Scotch whisky',
      price: 5200.00,
      sku: 'JW-BLACK-750',
      imageUrl: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
    },
  });

  await prisma.product.upsert({
    where: { businessUuid_sku: { businessUuid: gplace.businessUuid, sku: 'TUSK-GPLACE' } },
    update: {},
    create: {
      productUuid: '33333333-5555-1111-1111-000000000003',
      businessUuid: gplace.businessUuid,
      categoryUuid: gplaceBeersCat.categoryUuid,
      name: 'Tusker Lager (500ml)',
      description: 'Ice cold Kenyan lager',
      price: 350.00,
      sku: 'TUSK-GPLACE',
      imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
    },
  });

  console.info('✅ Products seeded');

  console.info('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

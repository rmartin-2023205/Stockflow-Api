import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

async function seed() {
  console.log('--- Configurando usuarios y datos demo de StockFlow ---');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create or Find Owner User
  let owner = await prisma.user.findUnique({
    where: { email: 'demo@stockflow.dev' },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: 'Martín (Propietario)',
        email: 'demo@stockflow.dev',
        passwordHash,
      },
    });
    console.log('✓ Usuario Propietario creado: demo@stockflow.dev');
  } else {
    await prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash },
    });
    console.log('✓ Contraseña de Propietario actualizada: demo@stockflow.dev');
  }

  // 2. Create or Find Organization
  let org = await prisma.organization.findFirst({
    where: {
      memberships: {
        some: { userId: owner.id, role: 'OWNER' },
      },
    },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Abarrotes & Súper StockFlow',
        currency: 'GTQ',
        memberships: {
          create: {
            userId: owner.id,
            role: 'OWNER',
          },
        },
      },
    });
    console.log('✓ Organización creada: Abarrotes & Súper StockFlow');
  }

  // 3. Create or Find Cashier User
  let cashier = await prisma.user.findUnique({
    where: { email: 'cajero@stockflow.dev' },
  });

  if (!cashier) {
    cashier = await prisma.user.create({
      data: {
        name: 'Ana Cajera',
        email: 'cajero@stockflow.dev',
        passwordHash,
      },
    });
    console.log('✓ Usuario Cajero creado: cajero@stockflow.dev');
  } else {
    await prisma.user.update({
      where: { id: cashier.id },
      data: { passwordHash },
    });
  }

  // Link Cashier to Org
  const cashierMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: cashier.id,
        organizationId: org.id,
      },
    },
  });

  if (!cashierMembership) {
    await prisma.membership.create({
      data: {
        userId: cashier.id,
        organizationId: org.id,
        role: 'CASHIER',
      },
    });
    console.log('✓ Membresía de Cajero asignada');
  }

  // 4. Create sample categories if none exist
  let catBebidas = await prisma.category.findFirst({
    where: { organizationId: org.id, name: 'Bebidas y Refrescos' },
  });
  if (!catBebidas) {
    catBebidas = await prisma.category.create({
      data: {
        organizationId: org.id,
        name: 'Bebidas y Refrescos',
        description: 'Gaseosas, jugos, energizantes y aguas purificadas',
      },
    });
  }

  let catAbarrotes = await prisma.category.findFirst({
    where: { organizationId: org.id, name: 'Abarrotes y Granos' },
  });
  if (!catAbarrotes) {
    catAbarrotes = await prisma.category.create({
      data: {
        organizationId: org.id,
        name: 'Abarrotes y Granos',
        description: 'Arroz, frijol, azúcar, harinas y aceites',
      },
    });
  }

  let catSnacks = await prisma.category.findFirst({
    where: { organizationId: org.id, name: 'Snacks y Golosinas' },
  });
  if (!catSnacks) {
    catSnacks = await prisma.category.create({
      data: {
        organizationId: org.id,
        name: 'Snacks y Golosinas',
        description: 'Frituras, galletas y chocolates',
      },
    });
  }

  // 5. Seed sample products
  const sampleProducts = [
    {
      sku: 'BEB-001',
      name: 'Coca-Cola 600ml Desechable',
      description: 'Botella de plástico no retornable',
      categoryId: catBebidas.id,
      costPrice: 5.5,
      salePrice: 8.0,
      stockQuantity: 45,
      minStock: 10,
    },
    {
      sku: 'BEB-002',
      name: 'Agua Pura Salvavidas 600ml',
      description: 'Agua purificada en botella',
      categoryId: catBebidas.id,
      costPrice: 2.2,
      salePrice: 4.0,
      stockQuantity: 60,
      minStock: 15,
    },
    {
      sku: 'ABA-001',
      name: 'Arroz Blanco Precocido 1lb',
      description: 'Arroz grano largo bolsa de 1 libra',
      categoryId: catAbarrotes.id,
      costPrice: 4.0,
      salePrice: 6.5,
      stockQuantity: 28,
      minStock: 8,
    },
    {
      sku: 'ABA-002',
      name: 'Aceite Vegetal Ideal 800ml',
      description: 'Aceite comestible de soya',
      categoryId: catAbarrotes.id,
      costPrice: 11.5,
      salePrice: 16.0,
      stockQuantity: 4, // Low stock demo!
      minStock: 6,
    },
    {
      sku: 'SNK-001',
      name: 'Papas Lays Clásicas 45g',
      description: 'Papas fritas con sal',
      categoryId: catSnacks.id,
      costPrice: 3.5,
      salePrice: 5.0,
      stockQuantity: 0, // Out of stock demo!
      minStock: 5,
    },
  ];

  for (const p of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: { organizationId: org.id, sku: p.sku },
    });

    if (!existing) {
      const prod = await prisma.product.create({
        data: {
          organizationId: org.id,
          ...p,
        },
      });

      if (p.stockQuantity > 0) {
        await prisma.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: prod.id,
            userId: owner.id,
            type: 'IN',
            quantity: p.stockQuantity,
            stockBefore: 0,
            stockAfter: p.stockQuantity,
            reason: 'Carga inicial de inventario demo',
          },
        });
      }
      console.log(`✓ Producto creado: ${p.sku} - ${p.name}`);
    }
  }

  console.log('--- Sembrado de datos demo completado exitosamente ---');
}

seed()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

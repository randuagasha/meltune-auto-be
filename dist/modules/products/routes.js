"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialProducts = exports.productsRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.productsRouter = (0, express_1.Router)();
exports.initialProducts = [
    {
        id: 'prd_motul_300v',
        name: 'Motul 300V Power 5W-40 (2L)',
        category: 'engine_oil',
        description: 'Ester Core Technology untuk perlindungan termal maksimal mesin performa tinggi. Pengurangan friksi internal optimal.',
        price: 680000,
        stock: 18,
        imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800',
        isAvailable: true,
    },
    {
        id: 'prd_liquimoly_molygen',
        name: 'Liqui Moly Molygen New Generation 5W-30 (4L)',
        category: 'engine_oil',
        description: 'Fluorescent green friction modifier berteknologi MFC (Molecular Friction Control) untuk efisiensi BBM dan keheningan katup.',
        price: 890000,
        stock: 14,
        imageUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=800',
        isAvailable: true,
    },
    {
        id: 'prd_brembo_dot4',
        name: 'Brembo Premium Brake Fluid DOT 4 Low Viscosity (1L)',
        category: 'parts',
        description: 'Titik didih basah tinggi (ERBP > 170°C) yang direkayasa khusus untuk kestabilan modul ABS dan ESP responsif.',
        price: 175000,
        stock: 32,
        imageUrl: 'https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&q=80&w=800',
        isAvailable: true,
    },
    {
        id: 'prd_meguiars_wash',
        name: 'Meguiar’s Gold Class Car Wash & Conditioner (1.89L)',
        category: 'car_care',
        description: 'Formula busa kaya conditioner membersihkan kotoran jalanan tanpa melunturkan lapisan wax protektif cat bodi.',
        price: 295000,
        stock: 24,
        imageUrl: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=800',
        isAvailable: true,
    },
    {
        id: 'prd_kn_cabin_filter',
        name: 'K&N Washable Cabin Air Filter (Universal Fit)',
        category: 'parts',
        description: 'Media elektrostatis premium menangkap partikel debu, polutan micro-PM2.5, serta menyerap bau apek kabin.',
        price: 650000,
        stock: 9,
        imageUrl: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&q=80&w=800',
        isAvailable: true,
    },
    {
        id: 'prd_tire_gauge_digital',
        name: 'TORSI Digital Precision Tire Pressure Gauge (150 PSI)',
        category: 'accessories',
        description: 'Sensor barometrik backlit digital dengan akurasi deviasi < 0.5 PSI. Pegangan ergonomis berfinishing anodized dark grey.',
        price: 220000,
        stock: 45,
        imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800',
        isAvailable: true,
    },
];
let productsData = [...exports.initialProducts];
exports.productsRouter.get('/', (req, res) => {
    const { category, search } = req.query;
    let filtered = [...productsData];
    if (category && category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
    }
    if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    (0, response_js_1.sendSuccess)(res, filtered, 'Katalog produk berhasil dimuat');
});
exports.productsRouter.get('/:id', (req, res) => {
    const item = productsData.find(p => p.id === req.params.id);
    if (!item) {
        (0, response_js_1.sendError)(res, 'Produk tidak ditemukan', 404);
        return;
    }
    (0, response_js_1.sendSuccess)(res, item, 'Detail produk');
});
exports.productsRouter.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (req, res) => {
    const { name, category, description, price, stock, imageUrl } = req.body;
    if (!name || !price || stock === undefined) {
        (0, response_js_1.sendError)(res, 'Nama, harga, dan stok wajib diisi', 400);
        return;
    }
    const newProduct = {
        id: `prd_${Date.now()}`,
        name,
        category: category || 'maintenance',
        description: description || '',
        price: Number(price),
        stock: Number(stock),
        imageUrl: imageUrl || '',
        isAvailable: true,
    };
    productsData.push(newProduct);
    (0, response_js_1.sendSuccess)(res, newProduct, 'Produk berhasil ditambahkan', 201);
});
exports.productsRouter.put('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (req, res) => {
    const idx = productsData.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Produk tidak ditemukan', 404);
        return;
    }
    productsData[idx] = { ...productsData[idx], ...req.body };
    (0, response_js_1.sendSuccess)(res, productsData[idx], 'Data produk berhasil diperbarui');
});
exports.productsRouter.delete('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (req, res) => {
    const idx = productsData.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Produk tidak ditemukan', 404);
        return;
    }
    productsData.splice(idx, 1);
    (0, response_js_1.sendSuccess)(res, { id: req.params.id }, 'Produk berhasil dihapus');
});

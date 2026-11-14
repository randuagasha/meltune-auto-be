import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const vehiclesRouter = Router();

export interface VehicleRecord {
  id: string;
  userId: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  transmission: 'manual' | 'automatic' | 'cvt';
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  notes?: string;
  createdAt: string;
}

const mockVehicles: VehicleRecord[] = [
  {
    id: 'veh_01',
    userId: 'usr_mock_user',
    brand: 'Honda',
    model: 'Civic Turbo (FK7)',
    year: 2021,
    licensePlate: 'B 1045 TRS',
    transmission: 'automatic',
    fuelType: 'petrol',
    notes: 'Rekomendasi oli sintetis 0W-20, servis berkala kelipatan 10.000 km.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_02',
    userId: 'usr_mock_user',
    brand: 'Toyota',
    model: 'Fortuner 2.8 VRZ',
    year: 2023,
    licensePlate: 'B 2291 TIK',
    transmission: 'automatic',
    fuelType: 'diesel',
    notes: 'Periksa filter solar dan tekanan ban berkala.',
    createdAt: new Date().toISOString(),
  },
];

vehiclesRouter.use(authenticateToken);

vehiclesRouter.get('/', (req: AuthenticatedRequest, res) => {
  const userVehicles = mockVehicles.filter(v => v.userId === req.user?.id || req.user?.role === 'superadmin');
  sendSuccess(res, userVehicles, 'Kendaraan berhasil dimuat');
});

vehiclesRouter.post('/', (req: AuthenticatedRequest, res) => {
  const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
  if (!brand || !model || !year || !licensePlate) {
    sendError(res, 'Merek, model, tahun, dan nomor plat wajib diisi', 400);
    return;
  }
  const newVehicle: VehicleRecord = {
    id: `veh_${Date.now()}`,
    userId: req.user!.id,
    brand,
    model,
    year: Number(year),
    licensePlate: licensePlate.toUpperCase(),
    transmission: transmission || 'automatic',
    fuelType: fuelType || 'petrol',
    notes,
    createdAt: new Date().toISOString(),
  };
  mockVehicles.push(newVehicle);
  sendSuccess(res, newVehicle, 'Kendaraan berhasil didaftarkan', 201);
});

vehiclesRouter.put('/:id', (req: AuthenticatedRequest, res) => {
  const idx = mockVehicles.findIndex(v => v.id === req.params.id);
  if (idx === -1) {
    sendError(res, 'Kendaraan tidak ditemukan', 404);
    return;
  }
  mockVehicles[idx] = { ...mockVehicles[idx], ...req.body };
  sendSuccess(res, mockVehicles[idx], 'Data kendaraan berhasil diperbarui');
});

vehiclesRouter.delete('/:id', (req: AuthenticatedRequest, res) => {
  const idx = mockVehicles.findIndex(v => v.id === req.params.id);
  if (idx === -1) {
    sendError(res, 'Kendaraan tidak ditemukan', 404);
    return;
  }
  mockVehicles.splice(idx, 1);
  sendSuccess(res, { id: req.params.id }, 'Kendaraan berhasil dihapus');
});

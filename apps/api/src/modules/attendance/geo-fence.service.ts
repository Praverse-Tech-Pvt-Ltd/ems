import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class GeoFenceService {
  private readonly logger = new Logger(GeoFenceService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Office locations configured in OfficeLocation take priority (supports
   * multiple offices, admin-editable). If none are active, falls back to a
   * single env-configured office (OFFICE_LAT/OFFICE_LNG/OFFICE_RADIUS_METERS)
   * so a fresh deployment isn't stuck failing closed before anyone seeds the
   * table. If neither is configured, fails closed (outside any office).
   */
  async isWithinAnyOffice(lat: number, lng: number): Promise<boolean> {
    const locations = await this.prisma.officeLocation.findMany({
      where: { isActive: true },
    });

    if (locations.length === 0) {
      return this.isWithinEnvOffice(lat, lng);
    }

    const result = locations.some((loc) => {
      const dist = this.haversineDistance(lat, lng, Number(loc.latitude), Number(loc.longitude));
      this.logger.log(
        `Geo-fence: user=(${lat},${lng}) office=(${loc.latitude},${loc.longitude}) dist=${dist.toFixed(1)}m radius=${loc.radiusMeters}m → ${dist <= loc.radiusMeters ? 'IN' : 'OUT'}`,
      );
      return dist <= loc.radiusMeters;
    });

    return result;
  }

  private isWithinEnvOffice(lat: number, lng: number): boolean {
    const officeLat = this.config.get<string>('OFFICE_LAT');
    const officeLng = this.config.get<string>('OFFICE_LNG');
    const radiusMeters = Number(this.config.get<string>('OFFICE_RADIUS_METERS'));

    if (!officeLat || !officeLng || !Number.isFinite(radiusMeters)) {
      this.logger.warn('Geo-fence: no active OfficeLocation rows and no OFFICE_LAT/OFFICE_LNG/OFFICE_RADIUS_METERS configured — treating all punches as outside office.');
      return false;
    }

    const dist = this.haversineDistance(lat, lng, Number(officeLat), Number(officeLng));
    this.logger.log(
      `Geo-fence (env fallback): user=(${lat},${lng}) office=(${officeLat},${officeLng}) dist=${dist.toFixed(1)}m radius=${radiusMeters}m → ${dist <= radiusMeters ? 'IN' : 'OUT'}`,
    );
    return dist <= radiusMeters;
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

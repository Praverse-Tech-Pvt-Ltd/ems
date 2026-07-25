import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class GeoFenceService {
  private readonly logger = new Logger(GeoFenceService.name);

  constructor(private prisma: PrismaService) {}

  async isWithinAnyOffice(lat: number, lng: number): Promise<boolean> {
    const locations = await this.prisma.officeLocation.findMany({
      where: { isActive: true },
    });

    // No office locations configured → fail closed (treat as outside any
    // office, so punch-ins are marked WFH rather than silently disabling
    // geo-fencing entirely).
    if (locations.length === 0) {
      this.logger.warn('Geo-fence: no active office locations configured — treating all punches as outside office.');
      return false;
    }

    let closest = Infinity;
    const result = locations.some((loc) => {
      const dist = this.haversineDistance(lat, lng, Number(loc.latitude), Number(loc.longitude));
      if (dist < closest) closest = dist;
      this.logger.log(
        `Geo-fence: user=(${lat},${lng}) office=(${loc.latitude},${loc.longitude}) dist=${dist.toFixed(1)}m radius=${loc.radiusMeters}m → ${dist <= loc.radiusMeters ? 'IN' : 'OUT'}`,
      );
      return dist <= loc.radiusMeters;
    });

    return result;
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

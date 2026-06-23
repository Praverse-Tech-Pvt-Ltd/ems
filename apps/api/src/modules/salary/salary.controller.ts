import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateSalarySlipDto,
  GeneratePayrollRunDto,
  GenerateSalarySlipDto,
  ReconcilePayrollRunDto,
  RejectSalarySlipDto,
  TransferSalarySlipDto,
  UpsertSalaryStructureDto,
} from './dto/create-slip.dto';

@ApiTags('Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private service: SalaryService) {}

  @Post('slips')
  @Roles('ADMIN', 'SUPER_ADMIN')
  upload(
    @CurrentUser() user: { id: string },
    @Body() body: CreateSalarySlipDto,
  ) {
    return this.service.upload(user.id, body);
  }

  @Get('structures')
  @Roles('ADMIN', 'SUPER_ADMIN')
  structures() {
    return this.service.listStructures();
  }

  @Post('structures/:employeeId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  upsertStructure(
    @CurrentUser() user: { id: string },
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() body: UpsertSalaryStructureDto,
  ) {
    return this.service.upsertStructure(user.id, employeeId, body);
  }

  @Post('slips/generate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  generate(
    @CurrentUser() user: { id: string },
    @Body() body: GenerateSalarySlipDto,
  ) {
    return this.service.generate(user.id, body);
  }

  @Post('payroll-runs/generate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  generatePayrollRun(
    @CurrentUser() user: { id: string },
    @Body() body: GeneratePayrollRunDto,
  ) {
    return this.service.generatePayrollRun(user.id, body);
  }

  @Get('payroll-runs')
  @Roles('ADMIN', 'SUPER_ADMIN')
  payrollRuns(
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.service.listPayrollRuns(month ? Number(month) : undefined, year ? Number(year) : undefined);
  }

  @Get('payroll-runs/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  payrollRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPayrollRun(id);
  }

  @Patch('payroll-runs/:id/review')
  @Roles('ADMIN', 'SUPER_ADMIN')
  reviewPayrollRun(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markPayrollRunReviewed(user.id, id);
  }

  @Post('payroll-runs/:id/reconcile')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  reconcilePayrollRun(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReconcilePayrollRunDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.reconcilePayrollRun(user.id, id, body.documentType, file);
  }

  @Patch('slips/:id/approve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  approve(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(user.id, id);
  }

  @Patch('slips/:id/transfer')
  @Roles('ADMIN', 'SUPER_ADMIN')
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransferSalarySlipDto,
  ) {
    return this.service.markTransferred(id, body);
  }

  @Patch('slips/:id/reject')
  @Roles('ADMIN', 'SUPER_ADMIN')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectSalarySlipDto,
  ) {
    return this.service.reject(id, body);
  }

  @Get('slips/my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get('slips/:id/pdf')
  async pdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: any) {
    const buffer = await this.service.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="salary-slip-${id}.pdf"`);
    res.end(buffer);
  }

  @Get('slips')
  @Roles('ADMIN', 'SUPER_ADMIN')
  findAll(
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.service.findAll(month, year);
  }
}

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SubmitMyDocumentDto, UpdateMyBankDetailsDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: { id: string; role: string }) {
    return this.service.findOne(user.id, user);
  }

  @Get('me/onboarding')
  @ApiOperation({ summary: 'Get own onboarding checklist' })
  getMyOnboarding(@CurrentUser() user: { id: string }) {
    return this.service.getMyOnboarding(user.id);
  }

  @Patch('me/bank-details')
  @ApiOperation({ summary: 'Update own bank and KYC details' })
  updateMyBankDetails(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateMyBankDetailsDto,
  ) {
    return this.service.updateMyBankDetails(user.id, dto);
  }

  @Post('me/documents')
  @ApiOperation({ summary: 'Submit own onboarding document metadata' })
  submitMyDocument(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitMyDocumentDto,
  ) {
    return this.service.submitMyDocument(user.id, dto);
  }

  @Post('me/documents/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new BadRequestException(
          `File type not allowed. Allowed: PDF, Word, Excel, images, text.`
        ), false);
      }
      cb(null, true);
    },
  }))
  @ApiOperation({ summary: 'Upload own onboarding document file' })
  uploadMyDocument(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Body('docType') docType: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.service.uploadMyDocument(user.id, docType, file);
  }

  @Delete('me/photo')
  @ApiOperation({ summary: 'Remove own profile photo' })
  removeMyPhoto(@CurrentUser() user: { id: string }) {
    return this.service.removeMyPhoto(user.id);
  }

  @Get('colleagues')
  @ApiOperation({ summary: 'List active colleagues for employee chat' })
  colleagues() {
    return this.service.findColleagues();
  }

  @Get('documents/review')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List employee documents for admin review' })
  documentsForReview() {
    return this.service.listDocumentsForReview();
  }

  @Patch('documents/:id/review')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Verify or reject an employee document' })
  reviewDocument(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string },
  ) {
    return this.service.reviewDocument(user.id, id, body);
  }

  @Get()
  @ApiOperation({ summary: 'List all employees' })
  findAll(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('role') role?: string,
  ) {
    return this.service.findAll({ search, departmentId, role });
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create new employee' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Get('departments')
  @ApiOperation({ summary: 'Get all departments' })
  getDepartments() {
    return this.service.getDepartments();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string; role: string }) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update employee' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Post('admin/seed-leave-balances')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Backfill leave balances for all existing employees' })
  async seedAllLeaveBalances() {
    return this.service.seedAllLeaveBalances();
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete employee [Super Admin]' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}

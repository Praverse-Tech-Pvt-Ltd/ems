import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
  UploadedFile, UseInterceptors,
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

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.service.findOne(user.id);
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
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload own onboarding document file' })
  uploadMyDocument(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Body('docType') docType: string,
  ) {
    return this.service.uploadMyDocument(user.id, docType, file);
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
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
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

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update employee' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete employee [Super Admin]' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}

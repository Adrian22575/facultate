import { z } from "zod";

export const UserTypeSchema = z.enum(["student", "elev"]);
export const InstitutionTypeSchema = z.enum(["university", "school"]);
export const AcademicUnitTypeSchema = z.enum(["faculty", "program", "profile"]);
export const CohortTypeSchema = z.enum(["student_group", "school_class"]);
export const VisibilityScopeSchema = z.enum(["private", "cohort", "program", "institution"]);

export const UpdateUserTypeSchema = z.object({
  userType: UserTypeSchema
});

export const CreateInstitutionSchema = z.object({
  userType: UserTypeSchema,
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  county: z.string().trim().max(120).optional()
});

export const CreateAcademicUnitSchema = z.object({
  userType: UserTypeSchema,
  institutionId: z.string().uuid(),
  unitType: AcademicUnitTypeSchema,
  parentUnitId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160)
});

export const CreateCohortSchema = z.object({
  userType: UserTypeSchema,
  institutionId: z.string().uuid(),
  programUnitId: z.string().uuid().optional(),
  label: z.string().trim().max(160).optional(),
  studyYearLabel: z.string().trim().max(80).optional(),
  groupLabel: z.string().trim().max(80).optional()
});

export const SaveMembershipSchema = z.object({
  userType: UserTypeSchema,
  institutionId: z.string().uuid(),
  programUnitId: z.string().uuid().optional()
});

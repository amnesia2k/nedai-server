ALTER TABLE "users"
ADD COLUMN "studentAcademicLevel" TEXT,
ADD COLUMN "dateOfBirth" DATE,
ADD COLUMN "lecturerHighestQualification" TEXT,
ADD COLUMN "lecturerCurrentAcademicStage" TEXT;

CREATE TYPE "Weekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

CREATE TABLE "timetable_activities" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dayOfWeek" "Weekday" NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "timetable_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "timetable_activities_userId_dayOfWeek_startTime_idx"
ON "timetable_activities"("userId", "dayOfWeek", "startTime");

ALTER TABLE "timetable_activities"
ADD CONSTRAINT "timetable_activities_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS "study_blocks";
DROP TABLE IF EXISTS "study_plans";

DROP TYPE IF EXISTS "StudyBlockStatus";
DROP TYPE IF EXISTS "StudyPlanStatus";
DROP TYPE IF EXISTS "StudyPlanMode";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createOrAssignSubject } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const CreateSubjectSchema = z
  .object({
    title: z.string().trim().min(3, "Scrie numele materiei.").max(160, "Numele este prea lung."),
    userType: z.enum(["student", "elev"]),
    studyYear: z.coerce.number().int().min(1).max(10).nullable().optional(),
    semester: z.coerce.number().int().min(1).max(2),
    schoolClass: z.string().trim().max(120).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.userType === "student" && !value.studyYear) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alege anul inainte sa adaugi materia.",
        path: ["studyYear"]
      });
    }

    if (value.userType === "elev" && !value.schoolClass) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Completeaza clasa inainte sa adaugi materia.",
        path: ["schoolClass"]
      });
    }
  });

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Trebuie sa fii logat." }, { status: 401 });
  }

  let payload;
  try {
    payload = CreateSubjectSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Datele introduse nu sunt valide."
        : "Datele introduse nu sunt valide.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await createOrAssignSubject({
      title: payload.title,
      userType: payload.userType,
      studyYear: payload.userType === "student" ? payload.studyYear : null,
      semester: payload.semester,
      schoolClass: payload.userType === "elev" ? payload.schoolClass : null,
      createdByUserId: user.id
    });

    revalidatePath("/");
    revalidatePath("/ai");
    revalidatePath("/materiale");
    revalidatePath("/materii");

    return NextResponse.json(result, { status: result.subjectCreated ? 201 : 200 });
  } catch (error) {
    console.error("create_subject_failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Materia nu a putut fi adaugata acum. Incearca din nou."
      },
      { status: 500 }
    );
  }
}

import { z } from "zod";
import { checkUsername, normalizeUsername, USERNAME_MAX, USERNAME_MIN } from "./username";

/**
 * Uma estratégia só: schemas Zod compartilhados entre o formulário, que usa os
 * mesmos objetos para validar e para tipar o estado, e a Server Action, que
 * revalida tudo porque payload de cliente é entrada não confiável.
 */

const trimmed = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string());

export const usernameField = trimmed
  .pipe(z.string().min(USERNAME_MIN, `Use ao menos ${USERNAME_MIN} caracteres.`))
  .pipe(z.string().max(USERNAME_MAX, `Use no máximo ${USERNAME_MAX} caracteres.`))
  .refine((value) => checkUsername(value) === null, { message: "Formato de @ inválido." })
  .transform(normalizeUsername);

export const displayNameField = trimmed.pipe(
  z.string().min(1, "Diga como você quer ser chamado.").max(80, "Máximo de 80 caracteres."),
);

export const emailField = z.email("E-mail inválido.");

export const passwordField = z
  .string()
  .min(8, "A senha precisa de ao menos 8 caracteres.")
  .max(72, "Senha muito longa.");

export const bioField = trimmed.pipe(z.string().max(300, "Máximo de 300 caracteres."));

export const descriptionField = trimmed.pipe(z.string().max(500, "Máximo de 500 caracteres."));

export const postContentField = trimmed.pipe(
  z.string().max(1000, "O limite é 1000 caracteres.").min(1, "Escreva algo antes de publicar."),
);

export const actorIdField = z.string().uuid("Identidade inválida.");

export const signUpSchema = z.object({
  displayName: displayNameField,
  username: usernameField,
  email: emailField,
  password: passwordField,
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Informe a senha."),
});

export const profileUpdateSchema = z.object({
  displayName: displayNameField,
  username: usernameField,
});

export const characterSchema = z.object({
  name: displayNameField,
  username: usernameField,
  bio: bioField.nullable(),
});

export const organizationSchema = z.object({
  name: displayNameField,
  username: usernameField,
  description: descriptionField.nullable(),
  type: z.enum(["organization", "institution", "media", "company", "group", "other"]),
});

export const createPostSchema = z.object({
  actorId: actorIdField,
  content: postContentField,
  media: z
    .array(
      z.object({
        storagePath: z.string().min(1).max(512),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        width: z.number().int().positive().max(20000).nullable(),
        height: z.number().int().positive().max(20000).nullable(),
        altText: z.string().trim().max(300),
      }),
    )
    .max(4, "No máximo 4 imagens por publicação.")
    .default([]),
  replyTo: z.string().uuid().nullable().default(null),
  repostOf: z.string().uuid().nullable().default(null),
});

export const replySchema = z.object({
  actorId: actorIdField,
  postId: z.string().uuid("Publicação inválida."),
  content: postContentField,
  media: createPostSchema.shape.media,
});

/** Recorte simples para transformar erros do Zod em `{ campo: mensagem }`. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

export const idleState: ActionState = { ok: false };

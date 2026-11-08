import { Type, type Static } from "typebox";

export const SettingsSchema = Type.Object(
  { deviceId: Type.String({ format: "uuid" }) },
);

export type Settings = Static<typeof SettingsSchema>;

type TextBeePayload = {
  success?: boolean;
  message?: string;
  error?: string;
  smsBatchId?: string;
  recipientCount?: number;
};

export type TextBeeSendResult =
  | {
      ok: true;
      smsBatchId?: string;
      queueMessage: string;
    }
  | {
      ok: false;
      error: string;
    };

export function buildTextBeeOtpMessage(code: string, expiryMinutes = 5): string {
  const template = process.env.TEXTBEE_OTP_SMS_TEMPLATE?.trim();
  if (template) {
    return template
      .replaceAll("{code}", code)
      .replaceAll("{minutes}", String(expiryMinutes));
  }

  return `The OTP for The Automate Learning Portal is ${code}`;
}

export function getTextBeeSimSubscriptionId(): number | undefined {
  const raw = process.env.TEXTBEE_SIM_SUBSCRIPTION_ID?.trim();
  if (!raw) {
    return undefined;
  }

  // Allow values like "2" even if a trailing inline comment slipped into .env
  const match = raw.match(/^(\d+)/);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

export function parseTextBeeSendResponse(
  status: number,
  body: string,
): TextBeeSendResult {
  let parsed: Record<string, unknown> | null = null;

  if (body) {
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const payload = (parsed?.data ?? parsed) as TextBeePayload | undefined;

  if (!status || status >= 400) {
    return {
      ok: false,
      error:
        payload?.error ||
        payload?.message ||
        `SMS provider request failed with status ${status}.`,
    };
  }

  if (payload?.success === false) {
    return {
      ok: false,
      error: payload.error || payload.message || "SMS provider rejected the request.",
    };
  }

  return {
    ok: true,
    smsBatchId: payload?.smsBatchId,
    queueMessage:
      payload?.message || "SMS queued on your TextBee device for processing.",
  };
}

package com.bidly.bidly_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${brevo.api.key:}")
    private String apiKey;

    @Value("${bidly.mail.from:noreply@bidly.com}")
    private String fromEmail;

    public void sendVerificationCode(String toEmail, String code) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("BREVO_API_KEY no configurada en Railway.");
            throw new RuntimeException("Servicio de email no configurado. Contactá al administrador.");
        }

        Map<String, Object> body = Map.of(
            "sender",      Map.of("name", "BIDLY", "email", fromEmail),
            "to",          List.of(Map.of("email", toEmail)),
            "subject",     "Tu código de verificación BIDLY — " + code,
            "htmlContent", buildHtml(code)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("api-key", apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                BREVO_URL, new HttpEntity<>(body, headers), String.class
            );
            log.info("Email enviado a {} — status {}", toEmail, response.getStatusCode());
        } catch (Exception e) {
            log.error("Error enviando email a {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("No se pudo enviar el email de verificación. Revisá tu dirección de correo.");
        }
    }

    private String buildHtml(String code) {
        return """
            <!DOCTYPE html>
            <html lang="es">
            <body style="margin:0;padding:0;background:#0a0f1e;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding:48px 16px;">
                  <table width="480" cellpadding="0" cellspacing="0"
                         style="background:#111827;border-radius:16px;padding:48px 40px;text-align:center;">
                    <tr><td>
                      <p style="color:#3b82f6;font-size:30px;font-weight:900;margin:0 0 4px;">BIDLY</p>
                      <p style="color:#6b7280;font-size:13px;margin:0 0 36px;letter-spacing:2px;">PLATAFORMA DE SUBASTAS</p>
                      <p style="color:#ffffff;font-size:16px;margin:0 0 8px;">Tu código de verificación:</p>
                      <div style="background:#1e293b;border-radius:12px;padding:28px 24px;margin:0 0 20px;">
                        <span style="color:#3b82f6;font-size:44px;font-weight:900;letter-spacing:14px;">%s</span>
                      </div>
                      <p style="color:#6b7280;font-size:13px;margin:0 0 32px;">
                        Este código expira en <strong style="color:#9ca3af;">10 minutos</strong>.
                      </p>
                      <p style="color:#4b5563;font-size:12px;margin:0;">
                        Si no solicitaste este código, podés ignorar este email.
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(code);
    }
}

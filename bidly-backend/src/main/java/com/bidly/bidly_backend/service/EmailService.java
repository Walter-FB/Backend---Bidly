package com.bidly.bidly_backend.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${bidly.mail.from:noreply@bidly.com}")
    private String fromEmail;

    public void sendVerificationCode(String toEmail, String code) {
        if (mailSender == null) {
            log.warn("JavaMailSender no configurado — verificar BREVO_SMTP_LOGIN y BREVO_SMTP_KEY en Railway.");
            throw new RuntimeException("Servicio de email no configurado. Contactá al administrador.");
        }
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Tu código de verificación BIDLY — " + code);
            helper.setText(buildHtml(code), true);
            mailSender.send(msg);
            log.info("Código de verificación enviado a {}", toEmail);
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

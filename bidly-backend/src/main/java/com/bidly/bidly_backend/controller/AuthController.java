package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.Credencial;
import com.bidly.bidly_backend.model.Persona;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.CredencialRepository;
import com.bidly.bidly_backend.repository.PersonaRepository;
import com.bidly.bidly_backend.service.EmailService;
import com.bidly.bidly_backend.service.UsuarioRolService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired private ClienteRepository clienteRepository;
    @Autowired private CredencialRepository credencialRepository;
    @Autowired private PersonaRepository personaRepository;
    @Autowired private EmailService emailService;
    @Autowired private UsuarioRolService usuarioRolService;

    // token UUID → clienteId (sesión activa)
    private final ConcurrentHashMap<String, Long> tokenStore = new ConcurrentHashMap<>();

    // email → {code, expiresAt}  (códigos de verificación pendientes)
    private final ConcurrentHashMap<String, VerificationEntry> pendingCodes = new ConcurrentHashMap<>();

    // verificationToken → email  (email ya verificado, listo para registrar)
    private final ConcurrentHashMap<String, String> verifiedTokens = new ConcurrentHashMap<>();

    private record VerificationEntry(String code, Instant expiresAt) {
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }

    // ─── ENVIAR CÓDIGO DE VERIFICACIÓN ───────────────────────────────────────
    @PostMapping("/send-verification")
    public ResponseEntity<?> sendVerification(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || !email.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email inválido."));
        }
        if (credencialRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "El email ya está registrado."));
        }
        String code = String.format("%06d", new Random().nextInt(1_000_000));
        pendingCodes.put(email, new VerificationEntry(code, Instant.now().plusSeconds(600)));
        try {
            emailService.sendVerificationCode(email, code);
            log.info("VERIFICACION - código enviado a {}", email);
            return ResponseEntity.ok(Map.of("message", "Código enviado a " + email));
        } catch (Exception e) {
            pendingCodes.remove(email);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ─── VERIFICAR CÓDIGO ─────────────────────────────────────────────────────
    @PostMapping("/verify-code")
    public ResponseEntity<?> verifyCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code  = body.get("code");
        if (email == null || code == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email y código son requeridos."));
        }
        VerificationEntry entry = pendingCodes.get(email);
        if (entry == null || entry.isExpired()) {
            pendingCodes.remove(email);
            return ResponseEntity.status(400).body(Map.of("error", "El código expiró. Pedí uno nuevo."));
        }
        if (!entry.code().equals(code.trim())) {
            return ResponseEntity.status(400).body(Map.of("error", "Código incorrecto."));
        }
        pendingCodes.remove(email);
        String verificationToken = UUID.randomUUID().toString();
        verifiedTokens.put(verificationToken, email);
        // El token de verificación expira en 30 minutos (limpieza lazy en register)
        log.info("VERIFICACION OK - email={}", email);
        return ResponseEntity.ok(Map.of("verificationToken", verificationToken));
    }

    // ─── LOGIN ────────────────────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        if (email == null || password == null) {
            log.warn("LOGIN - faltan campos: email={}", email);
            return ResponseEntity.badRequest().body(Map.of("error", "Email y contraseña son obligatorios"));
        }
        try {
            return credencialRepository.findByEmail(email)
                .filter(cred -> password.equals(cred.getPasswordHash()))
                .flatMap(cred -> clienteRepository.findById(cred.getCliente()))
                .map(c -> {
                    c.setEmail(email);
                    String token = UUID.randomUUID().toString();
                    tokenStore.put(token, c.getIdentificador());
                    log.info("LOGIN OK - email={} clienteId={}", email, c.getIdentificador());
                    return ResponseEntity.ok(buildUserResponse(token, c));
                })
                .orElseGet(() -> {
                    log.warn("LOGIN FALLIDO - email={}", email);
                    return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
                });
        } catch (Exception e) {
            log.error("LOGIN ERROR - email={} error={}", email, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Error interno al iniciar sesión"));
        }
    }

    // ─── ME ───────────────────────────────────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body(Map.of("error", "Token requerido"));
        }
        String token = authHeader.substring(7);
        Long clienteId = tokenStore.get(token);
        if (clienteId == null) {
            log.warn("ME - token inválido o sesión expirada");
            return ResponseEntity.status(401).body(Map.of("error", "Token inválido o sesión expirada"));
        }
        try {
            return clienteRepository.findById(clienteId)
                .map(c -> ResponseEntity.ok(buildUserResponse(token, c)))
                .orElseGet(() -> {
                    log.warn("ME - clienteId={} no encontrado en DB", clienteId);
                    return ResponseEntity.status(401).body(Map.of("error", "Usuario no encontrado"));
                });
        } catch (Exception e) {
            log.error("ME ERROR - clienteId={} error={}", clienteId, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Error interno"));
        }
    }

    // ─── REGISTER ─────────────────────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String verificationToken = body.get("verificationToken");
        String email             = body.get("email");
        String password          = body.get("password");

        // Validar token de verificación
        if (verificationToken == null || !verifiedTokens.containsKey(verificationToken)) {
            log.warn("REGISTRO - token de verificación inválido para email={}", email);
            return ResponseEntity.status(403).body(Map.of("error", "Email no verificado. Completá la verificación primero."));
        }
        String tokenEmail = verifiedTokens.get(verificationToken);
        if (!tokenEmail.equals(email)) {
            return ResponseEntity.status(403).body(Map.of("error", "El email no coincide con el token de verificación."));
        }
        verifiedTokens.remove(verificationToken);

        String nombre    = body.getOrDefault("nombre", "") + " " + body.getOrDefault("apellido", "");
        String documento = body.getOrDefault("documento", "");
        String direccion = body.getOrDefault("domicilio", "");

        log.info("REGISTRO INTENTO - email={}", email);
        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email y contraseña son obligatorios"));
        }
        try {
            if (credencialRepository.findByEmail(email).isPresent()) {
                log.warn("REGISTRO - email ya registrado: {}", email);
                return ResponseEntity.status(409).body(Map.of("error", "El email ya está registrado"));
            }
            Persona persona = new Persona();
            persona.setNombre(nombre.trim());
            persona.setDocumento(documento);
            persona.setDireccion(direccion);
            persona.setEstado("activo");
            persona = personaRepository.save(persona);
            log.info("REGISTRO - persona creada id={}", persona.getIdentificador());

            Cliente cliente = new Cliente();
            cliente.setIdentificador(persona.getIdentificador());
            cliente.setEmail(email);
            cliente.setPasswordHash(password);
            cliente.setCategoria("comun");
            cliente.setAdmitido("no");
            cliente.setVerificador(1L);
            int numeroPais = 1;
            try { numeroPais = Integer.parseInt(body.getOrDefault("numeroPais", "1")); }
            catch (NumberFormatException ignored) {}
            cliente.setNumeroPais(numeroPais);
            cliente = clienteRepository.save(cliente);
            Credencial cred = new Credencial();
            cred.setCliente(cliente.getIdentificador());
            cred.setEmail(email);
            cred.setPasswordHash(password);
            credencialRepository.save(cred);
            log.info("REGISTRO OK - email={} clienteId={}", email, cliente.getIdentificador());

            String token = UUID.randomUUID().toString();
            tokenStore.put(token, cliente.getIdentificador());
            return ResponseEntity.status(201).body(buildUserResponse(token, cliente));
        } catch (Exception e) {
            log.error("REGISTRO ERROR - email={} error={}", email, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Error al registrar usuario: " + e.getMessage()));
        }
    }

    private Map<String, Object> buildUserResponse(String token, Cliente c) {
        String nombre = personaRepository.findById(c.getIdentificador())
            .map(Persona::getNombre).orElse("");
        String email = (c.getEmail() != null) ? c.getEmail()
            : credencialRepository.findById(c.getIdentificador())
                  .map(Credencial::getEmail).orElse("");
        Map<String, Object> resp = new HashMap<>();
        resp.put("token", token);
        resp.put("clienteId", c.getIdentificador());
        resp.put("email", email);
        resp.put("categoria", c.getCategoria());
        resp.put("admitido", c.getAdmitido());
        resp.put("nombre", nombre);
        resp.put("rol", usuarioRolService.obtenerRol(c.getIdentificador()));
        return resp;
    }
}

package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.Persona;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.PersonaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private PersonaRepository personaRepository;

    // token UUID → clienteId (en memoria; se limpia al reiniciar el servidor)
    private final ConcurrentHashMap<String, Long> tokenStore = new ConcurrentHashMap<>();

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        return clienteRepository.findByEmail(email)
            .filter(c -> password.equals(c.getPasswordHash()))
            .map(c -> {
                String token = UUID.randomUUID().toString();
                tokenStore.put(token, c.getIdentificador());
                return ResponseEntity.ok(buildUserResponse(token, c));
            })
            .orElse(ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas")));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body(Map.of("error", "Token requerido"));
        }
        String token = authHeader.substring(7);
        Long clienteId = tokenStore.get(token);
        if (clienteId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Token inválido o sesión expirada"));
        }
        return clienteRepository.findById(clienteId)
            .map(c -> ResponseEntity.ok(buildUserResponse(token, c)))
            .orElse(ResponseEntity.status(401).body(Map.of("error", "Usuario no encontrado")));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String nombre = body.getOrDefault("nombre", "") + " " + body.getOrDefault("apellido", "");
        String documento = body.getOrDefault("documento", "");
        String direccion = body.getOrDefault("domicilio", "");
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email y contraseña son obligatorios"));
        }
        if (clienteRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "El email ya está registrado"));
        }

        Persona persona = new Persona();
        persona.setNombre(nombre.trim());
        persona.setDocumento(documento);
        persona.setDireccion(direccion);
        persona.setEstado("activo");
        persona = personaRepository.save(persona);

        Cliente cliente = new Cliente();
        cliente.setIdentificador(persona.getIdentificador());
        cliente.setEmail(email);
        cliente.setPasswordHash(password);
        cliente.setCategoria("comun");
        cliente.setAdmitido("no");
        cliente.setVerificador(1L); // empleado por defecto (gerente)
        Integer numeroPais = 1;
        try {
            numeroPais = Integer.parseInt(body.getOrDefault("numeroPais", "1"));
        } catch (NumberFormatException ignored) {}
        cliente.setNumeroPais(numeroPais);
        cliente = clienteRepository.save(cliente);

        String token = UUID.randomUUID().toString();
        tokenStore.put(token, cliente.getIdentificador());
        return ResponseEntity.status(201).body(buildUserResponse(token, cliente));
    }

    private Map<String, Object> buildUserResponse(String token, Cliente c) {
        String nombre = personaRepository.findById(c.getIdentificador())
            .map(Persona::getNombre)
            .orElse("");
        Map<String, Object> resp = new HashMap<>();
        resp.put("token", token);
        resp.put("clienteId", c.getIdentificador());
        resp.put("email", c.getEmail());
        resp.put("categoria", c.getCategoria());
        resp.put("admitido", c.getAdmitido());
        resp.put("nombre", nombre);
        return resp;
    }
}

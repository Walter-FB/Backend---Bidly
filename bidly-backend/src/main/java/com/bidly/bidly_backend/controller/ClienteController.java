package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.DniVerificacion;
import com.bidly.bidly_backend.model.MedioPago;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.DniVerificacionRepository;
import com.bidly.bidly_backend.repository.MedioPagoRepository;
import com.bidly.bidly_backend.repository.PersonaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private static final Set<String> CATEGORIAS_VALIDAS =
            Set.of("comun", "especial", "plata", "oro", "platino");

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private MedioPagoRepository medioPagoRepository;

    @Autowired
    private PersonaRepository personaRepository;

    @Autowired
    private DniVerificacionRepository dniVerificacionRepository;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Cliente cliente) {
        if (cliente.getIdentificador() == null || !personaRepository.existsById(cliente.getIdentificador())) {
            return ResponseEntity.badRequest().body(Map.of("error", "La persona no existe"));
        }
        return ResponseEntity.status(201).body(clienteRepository.save(cliente));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cliente> obtener(@PathVariable Long id) {
        return clienteRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/categoria")
    public ResponseEntity<?> actualizarCategoria(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body) {
        String categoria = body.get("categoria");
        if (categoria == null || !CATEGORIAS_VALIDAS.contains(categoria)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Categoría inválida. Valores permitidos: " + CATEGORIAS_VALIDAS));
        }
        return clienteRepository.findById(id)
                .map(c -> {
                    c.setCategoria(categoria);
                    return ResponseEntity.ok((Object) clienteRepository.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/admitido")
    public ResponseEntity<?> actualizarAdmitido(@PathVariable Long id,
                                                 @RequestBody Map<String, String> body) {
        String valor = body.get("admitido");
        if (!"si".equals(valor) && !"no".equals(valor)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'admitido' debe ser 'si' o 'no'"));
        }
        return clienteRepository.findById(id)
                .map(c -> {
                    c.setAdmitido(valor);
                    return ResponseEntity.ok((Object) clienteRepository.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/medios-pago")
    public ResponseEntity<?> listarMediosPago(@PathVariable Long id) {
        if (!clienteRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<MedioPago> medios = medioPagoRepository.findByClienteIdentificador(id);
        medios.forEach(m -> m.setVerificado("si"));
        return ResponseEntity.ok(medios);
    }

    @PostMapping("/{id}/medios-pago")
    public ResponseEntity<?> agregarMedioPago(@PathVariable Long id,
                                               @RequestBody MedioPago medioPago) {
        return clienteRepository.findById(id)
                .map(cliente -> {
                    medioPago.setCliente(cliente);
                    normalizarMedioPago(medioPago);
                    MedioPago guardado = medioPagoRepository.save(medioPago);
                    return ResponseEntity.status(201).<Object>body(guardado);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** Ajusta tipo/vencimiento al esquema de mediosdepago (tarjeta/cuenta/cheque, vencimiento ≤ 7). */
    private void normalizarMedioPago(MedioPago mp) {
        String tipo = mp.getTipo() != null ? mp.getTipo().trim().toLowerCase() : "";
        if ("credito".equals(tipo) || "debito".equals(tipo)) {
            if (mp.getBanco() == null || mp.getBanco().isBlank()) {
                mp.setBanco(tipo);
            }
            mp.setTipo("tarjeta");
        } else if (!Set.of("tarjeta", "cuenta", "cheque").contains(tipo)) {
            mp.setTipo("tarjeta");
        }
        if (mp.getVerificado() == null || mp.getVerificado().isBlank() || "no".equalsIgnoreCase(mp.getVerificado())) {
            mp.setVerificado("si");
        }
        String venc = mp.getVencimiento();
        if (venc != null && !venc.isBlank()) {
            venc = venc.trim();
            if (venc.matches("\\d{2}/\\d{2}")) {
                String[] p = venc.split("/");
                mp.setVencimiento("20" + p[1] + "-" + p[0]);
            } else if (venc.matches("\\d{2}/\\d{4}")) {
                String[] p = venc.split("/");
                mp.setVencimiento(p[1] + "-" + p[0]);
            }
            if (mp.getVencimiento().length() > 7) {
                mp.setVencimiento(mp.getVencimiento().substring(0, 7));
            }
        }
    }

    @PostMapping("/{id}/dni-fotos")
    public ResponseEntity<?> guardarDniFotos(
            @PathVariable Long id,
            @RequestParam("frente") MultipartFile frente,
            @RequestParam("dorso") MultipartFile dorso) {
        if (!clienteRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        try {
            DniVerificacion dni = new DniVerificacion();
            dni.setClienteId(id);
            dni.setFotoFrente(Base64.getEncoder().encodeToString(frente.getBytes()));
            dni.setFotoDorso(Base64.getEncoder().encodeToString(dorso.getBytes()));
            dni.setCreadoEn(LocalDateTime.now());
            dniVerificacionRepository.save(dni);
            return ResponseEntity.status(201).body(Map.of("message", "Fotos de DNI guardadas"));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "No se pudieron procesar las fotos"));
        }
    }
}

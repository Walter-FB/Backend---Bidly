package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Reembolso;
import com.bidly.bidly_backend.model.RegistroDeSubasta;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.ReembolsoRepository;
import com.bidly.bidly_backend.repository.RegistroDeSubastaRepository;
import com.bidly.bidly_backend.repository.RegistroPagoRepository;
import com.bidly.bidly_backend.repository.MedioPagoRepository;
import com.bidly.bidly_backend.model.RegistroPago;
import com.bidly.bidly_backend.repository.SubastaRepository;
import com.bidly.bidly_backend.service.SubastaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/registro-subasta")
public class RegistroController {

    @Autowired
    private RegistroDeSubastaRepository registroRepository;

    @Autowired
    private ReembolsoRepository reembolsoRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaService subastaService;

    @Autowired
    private RegistroPagoRepository registroPagoRepository;

    @Autowired
    private MedioPagoRepository medioPagoRepository;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody RegistroDeSubasta registro) {
        return ResponseEntity.status(201).body(registroRepository.save(registro));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RegistroDeSubasta> obtener(@PathVariable Long id) {
        return registroRepository.findById(id)
                .map(r -> {
                    enrichRegistro(r);
                    return ResponseEntity.ok(r);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/cliente/{id}")
    public ResponseEntity<List<RegistroDeSubasta>> historialCliente(@PathVariable Long id) {
        if (!clienteRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<RegistroDeSubasta> lista = registroRepository.findByClienteIdentificador(id);
        lista.forEach(this::enrichRegistro);
        return ResponseEntity.ok(lista);
    }

    @GetMapping("/subasta/{id}")
    public ResponseEntity<List<RegistroDeSubasta>> historialSubasta(@PathVariable Long id) {
        if (!subastaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<RegistroDeSubasta> lista = registroRepository.findBySubastaIdentificador(id);
        lista.forEach(this::enrichRegistro);
        return ResponseEntity.ok(lista);
    }

    private void enrichRegistro(RegistroDeSubasta r) {
        if (r.getSubasta() != null) {
            subastaService.enrich(r.getSubasta());
        }
        registroPagoRepository.findById(r.getIdentificador())
                .ifPresentOrElse(
                        p -> r.setEstadoPago(p.getEstado()),
                        () -> r.setEstadoPago("pendiente")
                );
    }

    @PostMapping("/{id}/pagar")
    public ResponseEntity<?> pagar(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object medioPagoRaw = body.get("medioPagoId");
        if (medioPagoRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "medioPagoId es requerido"));
        }
        Long medioPagoId;
        try {
            medioPagoId = Long.valueOf(medioPagoRaw.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "medioPagoId inválido"));
        }
        if (!medioPagoRepository.existsById(medioPagoId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Medio de pago no encontrado"));
        }
        return registroPagoRepository.findById(id)
                .map(pago -> {
                    pago.setEstado("pagado");
                    pago.setMedioPago(medioPagoId);
                    pago.setFechaPago(LocalDateTime.now());
                    registroPagoRepository.save(pago);
                    return ResponseEntity.ok(Map.of("ok", true));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/reembolso")
    public ResponseEntity<?> actualizarReembolso(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body) {
        String valor = body.get("reembolsada");
        if (!"si".equals(valor) && !"no".equals(valor)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'reembolsada' debe ser 'si' o 'no'"));
        }
        return registroRepository.findById(id)
                .map(r -> {
                    Reembolso reem = reembolsoRepository.findById(id).orElse(new Reembolso());
                    reem.setRegistro(id);
                    reem.setReembolsada(valor);
                    reembolsoRepository.save(reem);
                    r.setReembolsada(valor);
                    return ResponseEntity.ok((Object) r);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

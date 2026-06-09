package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.RegistroDeSubasta;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.RegistroDeSubastaRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/registro-subasta")
public class RegistroController {

    @Autowired
    private RegistroDeSubastaRepository registroRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private SubastaRepository subastaRepository;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody RegistroDeSubasta registro) {
        return ResponseEntity.status(201).body(registroRepository.save(registro));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RegistroDeSubasta> obtener(@PathVariable Long id) {
        return registroRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/cliente/{id}")
    public ResponseEntity<List<RegistroDeSubasta>> historialCliente(@PathVariable Long id) {
        if (!clienteRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(registroRepository.findByClienteIdentificador(id));
    }

    @GetMapping("/subasta/{id}")
    public ResponseEntity<List<RegistroDeSubasta>> historialSubasta(@PathVariable Long id) {
        if (!subastaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(registroRepository.findBySubastaIdentificador(id));
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
                    r.setReembolsada(valor);
                    return ResponseEntity.ok((Object) registroRepository.save(r));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

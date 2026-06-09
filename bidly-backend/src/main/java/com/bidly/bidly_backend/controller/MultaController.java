package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Multa;
import com.bidly.bidly_backend.repository.MultaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/multas")
public class MultaController {

    @Autowired
    private MultaRepository multaRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Multa> obtener(@PathVariable Long id) {
        return multaRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id,
                                         @RequestBody Map<String, String> body) {
        String pagada = body.get("pagada");
        if (!"si".equals(pagada) && !"no".equals(pagada)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'pagada' debe ser 'si' o 'no'"));
        }
        return multaRepository.findById(id)
                .map(m -> {
                    m.setPagada(pagada);
                    return ResponseEntity.ok((Object) multaRepository.save(m));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

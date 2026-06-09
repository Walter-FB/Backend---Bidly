package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Seguro;
import com.bidly.bidly_backend.repository.SeguroRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/seguros")
public class SeguroController {

    @Autowired
    private SeguroRepository seguroRepository;

    @GetMapping("/{nroPoliza}")
    public ResponseEntity<Seguro> obtener(@PathVariable String nroPoliza) {
        return seguroRepository.findById(nroPoliza)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Seguro> crear(@RequestBody Seguro seguro) {
        return ResponseEntity.status(201).body(seguroRepository.save(seguro));
    }

    @PutMapping("/{nroPoliza}")
    public ResponseEntity<?> actualizar(@PathVariable String nroPoliza, @RequestBody Seguro datos) {
        return seguroRepository.findById(nroPoliza)
                .map(s -> {
                    s.setCompania(datos.getCompania());
                    s.setPolizaCombinada(datos.getPolizaCombinada());
                    s.setImporte(datos.getImporte());
                    return ResponseEntity.ok(seguroRepository.save(s));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

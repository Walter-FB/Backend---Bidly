package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.Subastador;
import com.bidly.bidly_backend.repository.SubastaMonedaRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import com.bidly.bidly_backend.repository.SubastadorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/subastadores")
public class SubastadorController {

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastadorRepository subastadorRepository;

    @Autowired
    private SubastaMonedaRepository subastaMonedaRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Subastador> obtener(@PathVariable Long id) {
        return subastadorRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, Object> body) {
        Long id = Long.valueOf(body.get("identificador").toString());
        if (subastadorRepository.existsById(id)) {
            return ResponseEntity.ok(subastadorRepository.findById(id).get());
        }
        Subastador s = new Subastador();
        s.setIdentificador(id);
        s.setMatricula(body.containsKey("matricula") ? body.get("matricula").toString() : null);
        s.setRegion(body.containsKey("region") ? body.get("region").toString() : null);
        return ResponseEntity.status(201).body(subastadorRepository.save(s));
    }

    @GetMapping("/{id}/subastas")
    public ResponseEntity<List<Subasta>> subastas(@PathVariable Long id) {
        List<Subasta> resultado = subastaRepository.findBySubastador(id);
        resultado.forEach(sub ->
            subastaMonedaRepository.findById(sub.getIdentificador())
                .ifPresent(m -> sub.setMoneda(m.getMoneda()))
        );
        return ResponseEntity.ok(resultado);
    }
}

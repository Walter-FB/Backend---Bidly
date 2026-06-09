package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subastadores")
public class SubastadorController {

    @Autowired
    private SubastaRepository subastaRepository;

    @GetMapping("/{id}/subastas")
    public ResponseEntity<List<Subasta>> subastas(@PathVariable Long id) {
        List<Subasta> resultado = subastaRepository.findBySubastador(id);
        return ResponseEntity.ok(resultado);
    }
}

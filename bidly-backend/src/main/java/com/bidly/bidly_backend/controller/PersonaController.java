package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Persona;
import com.bidly.bidly_backend.repository.PersonaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/personas")
public class PersonaController {

    @Autowired
    private PersonaRepository personaRepository;

    @PostMapping
    public ResponseEntity<Persona> crear(@RequestBody Persona persona) {
        return ResponseEntity.status(201).body(personaRepository.save(persona));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Persona> obtener(@PathVariable Long id) {
        return personaRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Persona datos) {
        return personaRepository.findById(id)
                .map(p -> {
                    p.setDocumento(datos.getDocumento());
                    p.setNombre(datos.getNombre());
                    p.setDireccion(datos.getDireccion());
                    p.setEstado(datos.getEstado());
                    return ResponseEntity.ok(personaRepository.save(p));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> patchPersona(@PathVariable Long id, @RequestBody Map<String, String> campos) {
        return personaRepository.findById(id)
                .map(p -> {
                    if (campos.containsKey("documento")) p.setDocumento(campos.get("documento"));
                    if (campos.containsKey("nombre"))    p.setNombre(campos.get("nombre"));
                    if (campos.containsKey("direccion")) p.setDireccion(campos.get("direccion"));
                    if (campos.containsKey("estado"))    p.setEstado(campos.get("estado"));
                    return ResponseEntity.ok(personaRepository.save(p));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

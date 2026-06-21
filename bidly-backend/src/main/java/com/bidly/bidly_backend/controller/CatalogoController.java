package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Catalogo;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.CatalogoRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/catalogos")
public class CatalogoController {

    @Autowired
    private CatalogoRepository catalogoRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private SubastaRepository subastaRepository;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, Object> body) {
        Long subastaId = Long.valueOf(body.get("subasta").toString());
        Subasta subasta = subastaRepository.findById(subastaId).orElse(null);
        if (subasta == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Subasta no encontrada"));
        }
        Catalogo c = new Catalogo();
        c.setDescripcion(body.getOrDefault("descripcion", "Catálogo").toString());
        c.setSubasta(subasta);
        c.setResponsable(1L);
        return ResponseEntity.status(201).body(catalogoRepository.save(c));
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<ItemCatalogo>> items(@PathVariable Long id) {
        if (!catalogoRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(itemCatalogoRepository.findByCatalogoIdentificador(id));
    }
}

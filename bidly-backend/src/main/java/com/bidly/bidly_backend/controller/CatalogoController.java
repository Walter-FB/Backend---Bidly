package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.repository.CatalogoRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/catalogos")
public class CatalogoController {

    @Autowired
    private CatalogoRepository catalogoRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @GetMapping("/{id}/items")
    public ResponseEntity<List<ItemCatalogo>> items(@PathVariable Long id) {
        if (!catalogoRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(itemCatalogoRepository.findByCatalogoIdentificador(id));
    }
}

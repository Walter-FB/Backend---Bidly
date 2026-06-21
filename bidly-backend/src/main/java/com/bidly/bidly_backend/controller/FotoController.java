package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.repository.FotoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fotos")
public class FotoController {

    @Autowired
    private FotoRepository fotoRepository;

    @GetMapping(value = "/{id}", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> obtener(@PathVariable Long id) {
        var fotoOpt = fotoRepository.findById(id);
        if (fotoOpt.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(fotoOpt.get().getFoto());
    }
}

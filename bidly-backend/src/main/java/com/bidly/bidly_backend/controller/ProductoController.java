package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Foto;
import com.bidly.bidly_backend.model.Producto;
import com.bidly.bidly_backend.repository.FotoRepository;
import com.bidly.bidly_backend.repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private FotoRepository fotoRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Producto> obtener(@PathVariable Long id) {
        return productoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Producto> crear(@RequestBody Producto producto) {
        return ResponseEntity.status(201).body(productoRepository.save(producto));
    }

    @PatchMapping("/{id}/disponible")
    public ResponseEntity<?> toggleDisponible(@PathVariable Long id) {
        return productoRepository.findById(id)
                .map(p -> {
                    String nuevoEstado = "si".equals(p.getDisponible()) ? "no" : "si";
                    p.setDisponible(nuevoEstado);
                    return ResponseEntity.ok(productoRepository.save(p));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/fotos")
    public ResponseEntity<?> agregarFotos(@PathVariable Long id,
                                           @RequestBody Map<String, List<String>> body) {
        return productoRepository.findById(id)
                .map(producto -> {
                    List<String> urls = body.get("fotos");
                    if (urls == null || urls.isEmpty()) {
                        return ResponseEntity.badRequest()
                                .<Object>body(Map.of("error", "La lista de fotos no puede estar vacía"));
                    }
                    for (String url : urls) {
                        Foto foto = new Foto();
                        foto.setProducto(producto);
                        foto.setFoto(url.getBytes(StandardCharsets.UTF_8));
                        fotoRepository.save(foto);
                    }
                    return ResponseEntity.status(201)
                            .<Object>body(Map.of("guardadas", urls.size()));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

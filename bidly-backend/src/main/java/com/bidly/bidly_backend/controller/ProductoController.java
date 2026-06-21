package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Foto;
import com.bidly.bidly_backend.model.Producto;
import com.bidly.bidly_backend.repository.FotoRepository;
import com.bidly.bidly_backend.repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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
        // Si no viene revisor, usar el dueño para cumplir el NOT NULL de la DB
        if (producto.getRevisor() == null && producto.getDuenio() != null) {
            producto.setRevisor(producto.getDuenio());
        }
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

    @GetMapping("/{id}/fotos")
    public ResponseEntity<List<Long>> obtenerFotoIds(@PathVariable Long id) {
        if (!productoRepository.existsById(id)) return ResponseEntity.notFound().build();
        List<Long> ids = fotoRepository.findByProductoIdentificador(id).stream()
                .map(Foto::getIdentificador)
                .toList();
        return ResponseEntity.ok(ids);
    }

    @GetMapping(value = "/{id}/portada", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> portada(@PathVariable Long id) {
        List<Foto> fotos = fotoRepository.findByProductoIdentificador(id);
        if (fotos.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(fotos.get(0).getFoto());
    }

    @PostMapping(value = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ResponseEntity<?> agregarFotos(@PathVariable Long id,
                                       @RequestPart("fotos") List<MultipartFile> archivos) {
    return productoRepository.findById(id)
            .map(producto -> {
                if (archivos == null || archivos.isEmpty()) {
                    return ResponseEntity.badRequest()
                            .<Object>body(Map.of("error", "La lista de fotos no puede estar vacía"));
                }
                for (MultipartFile archivo : archivos) {
                    try {
                        Foto foto = new Foto();
                        foto.setProducto(producto);
                        foto.setFoto(archivo.getBytes());
                        fotoRepository.save(foto);
                    } catch (IOException e) {
                        return ResponseEntity.status(500)
                                .<Object>body(Map.of("error", "Error leyendo archivo: " + archivo.getOriginalFilename()));
                    }
                }
                return ResponseEntity.status(201)
                        .<Object>body(Map.of("guardadas", archivos.size()));
            })
            .orElse(ResponseEntity.notFound().build());
}
}
